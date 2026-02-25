/**
 * Sonos Library Spike — tests both @svrooij/sonos and sonos (bencevans)
 * against real Sonos hardware to determine which library to use.
 *
 * Usage:
 *   npx tsx spike-sonos.ts svrooij [--ip=192.168.x.x]
 *   npx tsx spike-sonos.ts bencevans [--ip=192.168.x.x]
 *   npx tsx spike-sonos.ts --help
 *
 * Examples:
 *   npx tsx spike-sonos.ts svrooij
 *   npx tsx spike-sonos.ts svrooij --ip=192.168.1.10
 *   npx tsx spike-sonos.ts bencevans
 *   npx tsx spike-sonos.ts bencevans --ip=192.168.1.10
 *
 * The script runs on the developer's machine (not in Docker) against real
 * Sonos speakers on the local network. Ensure you're on the same network
 * as the speakers before running.
 */

import { createRequire } from 'module'

const require = createRequire(import.meta.url)

// ─── Parse CLI arguments ────────────────────────────────────────────────────

const args = process.argv.slice(2)
const library = args.find(a => a === 'svrooij' || a === 'bencevans')
const ipArg = args.find(a => a.startsWith('--ip='))
const manualIp = ipArg ? ipArg.split('=')[1] : undefined
const showHelp = args.includes('--help') || args.includes('-h')

if (showHelp || !library) {
  console.log(`
Sonos Library Spike Script
===========================

Usage:
  npx tsx spike-sonos.ts <library> [--ip=<speaker-ip>]

Libraries:
  svrooij     Test @svrooij/sonos (TypeScript-native, recommended)
  bencevans   Test sonos (bencevans/node-sonos, fallback)

Options:
  --ip=<ip>   Manually specify a Sonos speaker IP for Test 2 (manual IP init)
              Example: --ip=192.168.1.10

Examples:
  npx tsx spike-sonos.ts svrooij
  npx tsx spike-sonos.ts svrooij --ip=192.168.1.10
  npx tsx spike-sonos.ts bencevans
  npx tsx spike-sonos.ts bencevans --ip=192.168.1.10

Output:
  The script prints PASS/FAIL for each test and a recommendation at the end.
  Run both libraries and compare results to choose the best option.
`)
  process.exit(0)
}

// ─── Result tracking ─────────────────────────────────────────────────────────

interface TestResult {
  name: string
  passed: boolean
  detail: string
}

const results: TestResult[] = []

function pass(name: string, detail: string): TestResult {
  const r = { name, passed: true, detail }
  results.push(r)
  console.log(`  [PASS] ${name}: ${detail}`)
  return r
}

function fail(name: string, detail: string): TestResult {
  const r = { name, passed: false, detail }
  results.push(r)
  console.log(`  [FAIL] ${name}: ${detail}`)
  return r
}

// ─── Direct SOAP fallback ─────────────────────────────────────────────────────

async function testDirectSoap(ip: string): Promise<void> {
  console.log('\n--- Direct SOAP Fallback (GetZoneGroupState) ---')
  const url = `http://${ip}:1400/ZoneGroupTopology/Control`
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <u:GetZoneGroupState xmlns:u="urn:schemas-upnp-org:service:ZoneGroupTopology:1">
    </u:GetZoneGroupState>
  </s:Body>
</s:Envelope>`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset="utf-8"',
        soapaction: '"urn:schemas-upnp-org:service:ZoneGroupTopology:1#GetZoneGroupState"',
      },
      body: soapBody,
      signal: AbortSignal.timeout(5000),
    })

    if (response.ok) {
      const text = await response.text()
      const hasZoneGroup = text.includes('ZoneGroup')
      const hasCoordinator = text.includes('Coordinator')
      if (hasZoneGroup && hasCoordinator) {
        pass('Direct SOAP', `GetZoneGroupState returned valid XML with ZoneGroup/Coordinator data`)
        console.log(`    Raw XML preview: ${text.slice(0, 200)}...`)
      } else {
        fail('Direct SOAP', `Response received but unexpected format: ${text.slice(0, 100)}`)
      }
    } else {
      fail('Direct SOAP', `HTTP ${response.status}: ${response.statusText}`)
    }
  } catch (err) {
    fail('Direct SOAP', `Error: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ─── Spike: @svrooij/sonos ────────────────────────────────────────────────────

async function runSvrooij(): Promise<void> {
  console.log('\n=== Spiking: @svrooij/sonos ===\n')

  // Dynamic import of CJS module
  const { SonosManager } = require('@svrooij/sonos') as {
    SonosManager: new () => {
      InitializeWithDiscovery(timeout: number): Promise<boolean>
      InitializeFromDevice(ip: string): Promise<boolean>
      Devices: Array<{
        Name: string
        GroupName: string
        uuid: string
        host: string
        port: number
        pause(): Promise<boolean>
        play(): Promise<boolean>
      }>
    }
  }

  const manager = new SonosManager()

  // Test 1: SSDP Discovery
  console.log('Test 1: SSDP Discovery (5s timeout)...')
  let discoveredDevices: typeof manager.Devices = []
  try {
    await manager.InitializeWithDiscovery(5)
    discoveredDevices = manager.Devices
    if (discoveredDevices.length > 0) {
      pass('SSDP Discovery', `Found ${discoveredDevices.length} device(s)`)
      discoveredDevices.forEach(d => {
        console.log(`    Device: ${d.Name} | Group: ${d.GroupName} | UUID: ${d.uuid} | IP: ${d.host}`)
      })
    } else {
      fail('SSDP Discovery', 'No devices found (0 speakers)')
    }
  } catch (err) {
    fail('SSDP Discovery', `Error: ${err instanceof Error ? err.message : String(err)}`)
  }

  // Test 2: Manual IP Init
  console.log('\nTest 2: Manual IP Initialization...')
  if (manualIp) {
    try {
      const manager2 = new SonosManager()
      await manager2.InitializeFromDevice(manualIp)
      const devices = manager2.Devices
      if (devices.length > 0) {
        pass('Manual IP Init', `Found ${devices.length} device(s) from IP ${manualIp}`)
        devices.forEach(d => {
          console.log(`    Device: ${d.Name} | Group: ${d.GroupName} | UUID: ${d.uuid}`)
        })
        // Use these devices for subsequent tests if SSDP found nothing
        if (discoveredDevices.length === 0) {
          discoveredDevices = devices
        }
      } else {
        fail('Manual IP Init', `No devices found from IP ${manualIp}`)
      }
    } catch (err) {
      fail('Manual IP Init', `Error: ${err instanceof Error ? err.message : String(err)}`)
    }
  } else {
    fail('Manual IP Init', 'Skipped — no --ip=<ip> argument provided. Rerun with --ip=<your-sonos-ip> to test.')
  }

  // Test 3: Basic Command (pause/play)
  console.log('\nTest 3: Basic Command (pause then play)...')
  const targetDevice = discoveredDevices[0]
  if (targetDevice) {
    try {
      console.log(`    Sending pause() to: ${targetDevice.Name} (${targetDevice.host})`)
      await targetDevice.pause()
      console.log('    pause() sent successfully')
      await new Promise(r => setTimeout(r, 1000))
      console.log('    Sending play() to restore state...')
      await targetDevice.play()
      pass('Basic Command', `pause()/play() sent to "${targetDevice.Name}" without errors`)
    } catch (err) {
      fail('Basic Command', `Error: ${err instanceof Error ? err.message : String(err)}`)
    }
  } else {
    fail('Basic Command', 'Skipped — no devices available (SSDP and manual IP both found nothing)')
  }

  // Test 4: Zone Group Coordinator Identification
  console.log('\nTest 4: Zone Group Coordinator Identification...')
  if (discoveredDevices.length > 0) {
    try {
      // Group devices by GroupName to identify coordinators
      const groups = new Map<string, typeof discoveredDevices>()
      for (const d of discoveredDevices) {
        const members = groups.get(d.GroupName) ?? []
        members.push(d)
        groups.set(d.GroupName, members)
      }

      const groupSummaries: string[] = []
      groups.forEach((members, groupName) => {
        // In @svrooij/sonos, the coordinator is typically the device
        // whose uuid matches the first part of the GroupName, or the
        // first device in the group. Log all members for inspection.
        const memberNames = members.map(m => m.Name).join(', ')
        groupSummaries.push(`Group "${groupName}": [${memberNames}]`)
        console.log(`    Group: ${groupName}`)
        members.forEach(m => {
          console.log(`      Member: ${m.Name} | UUID: ${m.uuid}`)
        })
      })

      pass('Coordinator ID', `Identified ${groups.size} group(s): ${groupSummaries.join('; ')}`)
    } catch (err) {
      fail('Coordinator ID', `Error: ${err instanceof Error ? err.message : String(err)}`)
    }
  } else {
    fail('Coordinator ID', 'Skipped — no devices available')
  }

  // Direct SOAP fallback if any test failed and we have an IP
  const anyFailed = results.some(r => !r.passed && r.detail !== 'Skipped — no --ip=<ip> argument provided. Rerun with --ip=<your-sonos-ip> to test.')
  const fallbackIp = manualIp ?? discoveredDevices[0]?.host
  if (anyFailed && fallbackIp) {
    await testDirectSoap(fallbackIp)
  }
}

// ─── Spike: sonos (bencevans) ─────────────────────────────────────────────────

async function runBencevans(): Promise<void> {
  console.log('\n=== Spiking: sonos (bencevans/node-sonos) ===\n')

  // Dynamic import of CJS module
  const SonosLib = require('sonos') as {
    Sonos: new (host: string, port?: number) => {
      host: string
      pause(): Promise<boolean>
      play(): Promise<boolean>
      getAllGroups(): Promise<Array<{
        host: string
        CoordinatorName?: string
        ZoneGroupMember: Array<{ ZoneName: string; UUID: string; Location?: string }>
        Coordinator?: string
      }>>
      currentTrack(): Promise<Record<string, unknown>>
    }
    AsyncDeviceDiscovery: new () => {
      discover(options?: { timeout?: number }): Promise<{
        host: string
        currentTrack(): Promise<Record<string, unknown>>
        getAllGroups(): Promise<unknown[]>
      }>
    }
  }

  let firstDevice: { host: string; pause(): Promise<boolean>; play(): Promise<boolean>; getAllGroups(): Promise<unknown[]> } | null = null

  // Test 1: SSDP Discovery
  console.log('Test 1: SSDP Discovery (5s timeout)...')
  try {
    const discovery = new SonosLib.AsyncDeviceDiscovery()
    const device = await Promise.race([
      discovery.discover({ timeout: 5000 }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Discovery timeout after 5s')), 6000)
      ),
    ])

    if (device?.host) {
      pass('SSDP Discovery', `Found device at ${device.host}`)
      firstDevice = device as unknown as typeof firstDevice
      console.log(`    Device IP: ${device.host}`)
      try {
        const track = await device.currentTrack()
        console.log(`    Current track: ${JSON.stringify(track)}`)
      } catch {
        console.log('    currentTrack(): unavailable (may be stopped)')
      }
    } else {
      fail('SSDP Discovery', 'No device found')
    }
  } catch (err) {
    fail('SSDP Discovery', `Error: ${err instanceof Error ? err.message : String(err)}`)
  }

  // Test 2: Manual IP Init
  console.log('\nTest 2: Manual IP Initialization...')
  if (manualIp) {
    try {
      const device = new SonosLib.Sonos(manualIp)
      const groups = await device.getAllGroups()
      if (groups && groups.length > 0) {
        pass('Manual IP Init', `getAllGroups() returned ${groups.length} group(s) from IP ${manualIp}`)
        console.log(`    Groups: ${JSON.stringify(groups, null, 2).slice(0, 300)}`)
        if (!firstDevice) {
          firstDevice = device as unknown as typeof firstDevice
        }
      } else {
        fail('Manual IP Init', `getAllGroups() returned empty from IP ${manualIp}`)
      }
    } catch (err) {
      fail('Manual IP Init', `Error: ${err instanceof Error ? err.message : String(err)}`)
    }
  } else {
    fail('Manual IP Init', 'Skipped — no --ip=<ip> argument provided. Rerun with --ip=<your-sonos-ip> to test.')
  }

  // Test 3: Basic Command (pause/play)
  console.log('\nTest 3: Basic Command (pause then play)...')
  if (firstDevice) {
    try {
      const deviceForCommands = manualIp ? new SonosLib.Sonos(manualIp) : new SonosLib.Sonos(firstDevice.host)
      console.log(`    Sending pause() to: ${deviceForCommands.host}`)
      await deviceForCommands.pause()
      console.log('    pause() sent successfully')
      await new Promise(r => setTimeout(r, 1000))
      console.log('    Sending play() to restore state...')
      await deviceForCommands.play()
      pass('Basic Command', `pause()/play() sent to "${deviceForCommands.host}" without errors`)
    } catch (err) {
      fail('Basic Command', `Error: ${err instanceof Error ? err.message : String(err)}`)
    }
  } else {
    fail('Basic Command', 'Skipped — no devices available (SSDP and manual IP both found nothing)')
  }

  // Test 4: Zone Group Coordinator Identification
  console.log('\nTest 4: Zone Group Coordinator Identification...')
  const ipForGroups = manualIp ?? firstDevice?.host
  if (ipForGroups) {
    try {
      const device = new SonosLib.Sonos(ipForGroups)
      const groups = await device.getAllGroups() as Array<{
        host: string
        Coordinator?: string
        ZoneGroupMember: Array<{ ZoneName: string; UUID: string; Location?: string }>
      }>

      if (groups && groups.length > 0) {
        groups.forEach((group, i) => {
          const coordinatorUuid = group.Coordinator
          const members = group.ZoneGroupMember ?? []
          const coordinator = members.find((m: { UUID: string }) => m.UUID === coordinatorUuid)
          const memberNames = members.map((m: { ZoneName: string }) => m.ZoneName).join(', ')
          console.log(`    Group ${i + 1}: Coordinator=${coordinator?.ZoneName ?? coordinatorUuid ?? 'unknown'} | Members=[${memberNames}]`)
        })
        pass('Coordinator ID', `Identified ${groups.length} group(s) with coordinator info`)
      } else {
        fail('Coordinator ID', 'getAllGroups() returned empty or null')
      }
    } catch (err) {
      fail('Coordinator ID', `Error: ${err instanceof Error ? err.message : String(err)}`)
    }
  } else {
    fail('Coordinator ID', 'Skipped — no devices available')
  }

  // Direct SOAP fallback if any test failed and we have an IP
  const anyFailed = results.some(r => !r.passed && !r.detail.startsWith('Skipped'))
  const fallbackIp = manualIp ?? firstDevice?.host
  if (anyFailed && fallbackIp) {
    await testDirectSoap(fallbackIp)
  }
}

// ─── Print summary ────────────────────────────────────────────────────────────

function printSummary(): void {
  console.log('\n=== SPIKE RESULTS ===')
  console.log(`Library: ${library === 'svrooij' ? '@svrooij/sonos' : 'sonos (bencevans)'}`)

  const testNames = ['SSDP Discovery', 'Manual IP Init', 'Basic Command', 'Coordinator ID', 'Direct SOAP']
  for (const name of testNames) {
    const r = results.find(x => x.name === name)
    if (r) {
      const status = r.passed ? 'PASS' : 'FAIL'
      console.log(`${name.padEnd(20)}: ${status} (${r.detail})`)
    }
  }

  const passed = results.filter(r => r.passed).length
  const total = results.length
  const criticalPassed = results.find(r => r.name === 'SSDP Discovery')?.passed ||
    results.find(r => r.name === 'Manual IP Init')?.passed
  const commandPassed = results.find(r => r.name === 'Basic Command')?.passed
  const directSoapPassed = results.find(r => r.name === 'Direct SOAP')?.passed

  console.log('\n=== RECOMMENDATION ===')
  if (criticalPassed && commandPassed) {
    console.log(`Use: ${library === 'svrooij' ? '@svrooij/sonos' : 'sonos (bencevans)'}`)
    console.log(`     Discovery and basic commands work. Safe to build on this library.`)
  } else if (directSoapPassed) {
    console.log(`Use: direct SOAP (raw fetch to port 1400)`)
    console.log(`     Library failed but direct HTTP/SOAP works. Implement thin wrappers.`)
    console.log(`     See: https://sonos.svrooij.io/services/zone-group-topology`)
  } else {
    console.log(`Use: UNKNOWN — all tests failed.`)
    console.log(`     Verify speakers are on the same network and powered on.`)
    console.log(`     Try running with --ip=<speaker-ip> to bypass SSDP.`)
    console.log(`     If SSDP fails but manual IP works, SSDP multicast may be blocked.`)
  }
  console.log(`\nPassed: ${passed}/${total} tests`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\nSonos Library Spike`)
  console.log(`Library: ${library === 'svrooij' ? '@svrooij/sonos v2.5.0' : 'sonos (bencevans) v1.14.2'}`)
  if (manualIp) console.log(`Manual IP: ${manualIp}`)
  console.log(`Network: ensure you are on the same LAN as the Sonos speakers\n`)

  try {
    if (library === 'svrooij') {
      await runSvrooij()
    } else {
      await runBencevans()
    }
  } catch (err) {
    console.error('\nFatal error during spike:', err)
  }

  printSummary()
  process.exit(0)
}

main()
