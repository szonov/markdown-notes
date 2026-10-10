// Builds a signed, notarized macOS app and DMG. See docs/macos-distribution.md.
//
//   pnpm release:macos [flags]
//
//   --target=<triple>       Default: the host triple
//   --artifact-dir=<path>   Copy the release assets there after the build
//   --no-notarize           Signed-only build, for local runs without Apple credentials
//   --no-sign               Unsigned app only, to check that it compiles and bundles

import { randomBytes } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { apply as applyMergePatch } from 'tiny-merge-patch'
import { exec } from 'tinyexec'
import { z } from 'zod'
import {
  getHostTriple,
  INHERIT,
  log,
  readAppVersion,
  resolveApiKey,
  runTauri,
  runWithTempDir,
  TARGET_DIR,
  TAURI_SRC_DIR,
} from './helpers.ts'

const INTEL_TARGET = 'x86_64-apple-darwin'
const ARCHS: Record<string, string> = {
  'aarch64-apple-darwin': 'aarch64',
  [INTEL_TARGET]: 'x86_64',
}
const TauriConfigSchema = z.object({
  productName: z.string(),
  bundle: z.object({
    macOS: z.object({
      entitlements: z.string(),
    }),
  }),
})

interface Bundle {
  readonly target: string
  readonly arch: string
  /** The asset name prefix. GitHub rewrites spaces in asset names to dots, so do it up front. */
  readonly assetName: string
  readonly version: string
  readonly entitlements: string
  readonly app: string
  readonly dmg: string
  readonly updaterArchive: string
}

interface Signer {
  readonly identity: string
  readonly keychain: string | null
}

/** Resolves the config the way `tauri build` does: base, then platform file. */
function readTauriConfig(): z.infer<typeof TauriConfigSchema> {
  let config: unknown = {}
  for (const file of ['tauri.conf.json', 'tauri.macos.conf.json']) {
    const patch: unknown = JSON.parse(readFileSync(join(TAURI_SRC_DIR, file), 'utf8'))
    config = applyMergePatch(config, patch)
  }
  return TauriConfigSchema.parse(config)
}

function resolveBundle(target: string): Bundle {
  const arch = ARCHS[target]
  if (!arch) {
    throw new Error(`unsupported target "${target}"`)
  }
  const { productName, bundle } = readTauriConfig()
  const version = readAppVersion()
  const bundleDir = join(TARGET_DIR, target, 'release', 'bundle')
  const app = join(bundleDir, 'macos', `${productName}.app`)
  return {
    target,
    arch,
    assetName: productName.replaceAll(' ', '.'),
    version,
    entitlements: join(TAURI_SRC_DIR, bundle.macOS.entitlements),
    app,
    dmg: join(bundleDir, 'dmg', `${productName}_${version}_${arch}.dmg`),
    updaterArchive: `${app}.tar.gz`,
  }
}

function resolveNotaryArgs(identity: string, tempDir: string): string[] {
  const apiKey = resolveApiKey(tempDir)
  if (apiKey) {
    return ['--key', apiKey.keyPath, '--key-id', apiKey.keyId, '--issuer', apiKey.issuer]
  }
  const { APPLE_ID, APPLE_PASSWORD } = process.env
  const teamId = process.env.APPLE_TEAM_ID ?? /\(([0-9A-Z]{10})\)$/.exec(identity)?.[1]
  if (!APPLE_ID || !APPLE_PASSWORD || !teamId) {
    throw new Error('no notarization credentials: set APPLE_API_KEY or APPLE_ID')
  }
  return ['--apple-id', APPLE_ID, '--password', APPLE_PASSWORD, '--team-id', teamId]
}

async function buildApp(target: string): Promise<void> {
  const args = ['build', '--target', target, '--bundles', 'app']
  // Tauri notarizes whenever these are set; this script signs and notarizes
  // explicitly after the bundle has been assembled.
  for (const name of ['APPLE_ID', 'APPLE_PASSWORD', 'APPLE_API_KEY', 'APPLE_API_ISSUER']) {
    delete process.env[name]
  }
  await runTauri(args)
}

/**
 * Imports `APPLE_CERTIFICATE` into a temporary keychain for the signing steps
 * that run after Tauri has removed its own. Without the variable, the login
 * keychain is used.
 */
async function runWithSigningKeychain(
  tempDir: string,
  action: (keychain: string | null) => Promise<void>,
): Promise<void> {
  const { APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASSWORD } = process.env
  if (!APPLE_CERTIFICATE || !APPLE_CERTIFICATE_PASSWORD) {
    return await action(null)
  }

  const certificate = join(tempDir, 'certificate.p12')
  const keychain = join(tempDir, 'signing.keychain-db')
  const password = randomBytes(24).toString('hex')
  const searchList = await exec('security', ['list-keychains', '-d', 'user'], {
    throwOnError: true,
  })
  const previous = [...searchList.stdout.matchAll(/"([^"]+)"/g)].flatMap((match) => match[1] ?? [])
  writeFileSync(certificate, Buffer.from(APPLE_CERTIFICATE, 'base64'), { mode: 0o600 })
  const steps = [
    ['create-keychain', '-p', password, keychain],
    // Notarization can outlast the default five-minute auto-lock.
    ['set-keychain-settings', '-lut', '21600', keychain],
    ['unlock-keychain', '-p', password, keychain],
    ['list-keychains', '-d', 'user', '-s', keychain, ...previous],
    [
      'import',
      certificate,
      '-k',
      keychain,
      '-P',
      APPLE_CERTIFICATE_PASSWORD,
      '-T',
      '/usr/bin/codesign',
    ],
    [
      'set-key-partition-list',
      '-S',
      'apple-tool:,apple:,codesign:',
      '-s',
      '-k',
      password,
      keychain,
    ],
  ]
  try {
    for (const step of steps) {
      await exec('security', step, { throwOnError: true })
    }
    await action(keychain)
  } finally {
    await exec('security', ['list-keychains', '-d', 'user', '-s', ...previous])
    await exec('security', ['delete-keychain', keychain])
  }
}

async function runCodesign(signer: Signer, args: readonly string[]): Promise<void> {
  const keychain = signer.keychain ? ['--keychain', signer.keychain] : []
  const base = ['--force', '--sign', signer.identity, '--timestamp']
  await exec('codesign', [...base, ...keychain, ...args], INHERIT)
}

/** Re-sign the completed app with the minimal configured entitlements. */
async function resignApp(bundle: Bundle, signer: Signer): Promise<void> {
  await runCodesign(signer, [
    '--options',
    'runtime',
    '--entitlements',
    bundle.entitlements,
    bundle.app,
  ])
}

async function notarize(path: string, notaryArgs: readonly string[]): Promise<void> {
  log(`notarizing ${basename(path)}`)
  const submit = ['notarytool', 'submit', path, ...notaryArgs, '--wait', '--output-format', 'json']
  const { stdout, stderr } = await exec('xcrun', submit)
  const verdict = z
    .object({ id: z.string(), status: z.string() })
    .safeParse(stdout.startsWith('{') ? JSON.parse(stdout) : null).data
  if (verdict?.status === 'Accepted') {
    return
  }
  const report = verdict
    ? await exec('xcrun', ['notarytool', 'log', verdict.id, ...notaryArgs])
    : null
  throw new Error(`notarization of ${basename(path)} failed\n${report?.stdout ?? stdout + stderr}`)
}

async function notarizeApp(
  bundle: Bundle,
  notaryArgs: readonly string[],
  tempDir: string,
): Promise<void> {
  const zip = join(tempDir, `${basename(bundle.app)}.zip`)
  await exec('ditto', ['-c', '-k', '--keepParent', bundle.app, zip], INHERIT)
  await notarize(zip, notaryArgs)
  await exec('xcrun', ['stapler', 'staple', bundle.app], INHERIT)
}

/** The updater payload must come from the re-signed app, so Tauri cannot create it. */
async function createUpdaterArchive(bundle: Bundle): Promise<void> {
  rmSync(`${bundle.updaterArchive}.sig`, { force: true })
  const tarArgs = ['-czf', bundle.updaterArchive, '-C', dirname(bundle.app), basename(bundle.app)]
  await exec('tar', tarArgs, INHERIT)
  // An unset password makes the signer prompt.
  const password = process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? ''
  await runTauri(['signer', 'sign', bundle.updaterArchive], {
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: password,
  })
}

/**
 * Tauri's DMG script drives Finder and is brittle on CI. `hdiutil` under-sizes
 * a compressed image made straight from a folder, so build a writable image
 * with headroom first, then compress it.
 */
async function createDmg(bundle: Bundle, signer: Signer, tempDir: string): Promise<void> {
  const stagingDir = join(tempDir, 'dmg')
  const writableDmg = join(tempDir, 'writable.dmg')
  mkdirSync(stagingDir)
  await exec('ditto', [bundle.app, join(stagingDir, basename(bundle.app))], INHERIT)
  symlinkSync('/Applications', join(stagingDir, 'Applications'))

  const usage = await exec('du', ['-sk', stagingDir], { throwOnError: true })
  const usedKb = Number(usage.stdout.split('\t')[0])
  const sizeMb = Math.ceil(usedKb / 1024) * 2 + 32
  const volumeName = basename(bundle.app, '.app')
  const createArgs = ['-volname', volumeName, '-srcfolder', stagingDir, '-format', 'UDRW']
  await exec('hdiutil', ['create', ...createArgs, '-size', `${sizeMb}m`, writableDmg], INHERIT)
  mkdirSync(dirname(bundle.dmg), { recursive: true })
  const convertArgs = ['-format', 'UDZO', '-imagekey', 'zlib-level=9', '-ov', '-o', bundle.dmg]
  await exec('hdiutil', ['convert', writableDmg, ...convertArgs], INHERIT)
  await runCodesign(signer, [bundle.dmg])
}

async function expectOutput(
  command: string,
  args: readonly string[],
  expected: readonly string[],
): Promise<void> {
  const { exitCode, stdout, stderr } = await exec(command, args, {
    nodeOptions: { stdio: ['ignore', 'pipe', 'pipe'] },
  })
  const output = `${stdout}${stderr}`
  if (exitCode !== 0 || !expected.every((text) => output.includes(text))) {
    throw new Error(`check failed: ${command} ${args.join(' ')}\n${output}`)
  }
}

async function verify(bundle: Bundle, notarized: boolean): Promise<void> {
  await expectOutput(
    'codesign',
    ['--verify', '--deep', '--strict', '--verbose=2', bundle.app],
    ['valid on disk', 'satisfies its Designated Requirement'],
  )
  if (!notarized) {
    return
  }
  const accepted = ['accepted', 'source=Notarized Developer ID']
  await expectOutput('spctl', ['--assess', '--type', 'execute', '-v', bundle.app], accepted)
  const openContext = ['--type', 'open', '--context', 'context:primary-signature']
  await expectOutput('spctl', ['--assess', ...openContext, '-v', bundle.dmg], accepted)
  for (const path of [bundle.app, bundle.dmg]) {
    await expectOutput('xcrun', ['stapler', 'validate', path], ['The validate action worked!'])
  }
}

/** Copies the release assets under the names they are published with. */
function exportArtifacts(bundle: Bundle, artifactDir: string): void {
  const archiveName = `${bundle.assetName}_${bundle.version}_${bundle.arch}.app.tar.gz`
  mkdirSync(artifactDir, { recursive: true })
  copyFileSync(bundle.dmg, join(artifactDir, `${bundle.assetName}_${bundle.arch}.dmg`))
  copyFileSync(bundle.updaterArchive, join(artifactDir, archiveName))
  copyFileSync(`${bundle.updaterArchive}.sig`, join(artifactDir, `${archiveName}.sig`))
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      target: { type: 'string' },
      'artifact-dir': { type: 'string' },
      'no-notarize': { type: 'boolean', default: false },
      'no-sign': { type: 'boolean', default: false },
    },
  })
  const artifactDir = values['artifact-dir']
  if (values['no-sign']) {
    if (artifactDir) {
      throw new Error('--no-sign makes no release assets, so it cannot be used with --artifact-dir')
    }
    const { target, app } = resolveBundle(values.target ?? (await getHostTriple()))
    await buildApp(target)
    log(`done (unsigned): ${app}`)
    return
  }
  const identity = process.env.APPLE_SIGNING_IDENTITY
  if (!identity) {
    throw new Error('APPLE_SIGNING_IDENTITY is not set')
  }
  const hasUpdaterKey = Boolean(process.env.TAURI_SIGNING_PRIVATE_KEY)
  if (artifactDir && !hasUpdaterKey) {
    throw new Error('TAURI_SIGNING_PRIVATE_KEY is not set')
  }
  const bundle = resolveBundle(values.target ?? (await getHostTriple()))

  await runWithTempDir(async (tempDir) => {
    const notaryArgs = values['no-notarize'] ? null : resolveNotaryArgs(identity, tempDir)
    await buildApp(bundle.target)
    await runWithSigningKeychain(tempDir, async (keychain) => {
      const signer = { identity, keychain }
      await resignApp(bundle, signer)
      if (notaryArgs) {
        await notarizeApp(bundle, notaryArgs, tempDir)
      }
      if (hasUpdaterKey) {
        await createUpdaterArchive(bundle)
      }
      await createDmg(bundle, signer, tempDir)
    })
    if (notaryArgs) {
      await notarize(bundle.dmg, notaryArgs)
      await exec('xcrun', ['stapler', 'staple', bundle.dmg], INHERIT)
    }
    await verify(bundle, notaryArgs !== null)
  })
  if (artifactDir) {
    exportArtifacts(bundle, artifactDir)
  }
  log(`done: ${bundle.dmg}`)
}

await main()
