import { XMLParser } from 'fast-xml-parser'
import type { SpeakerInfo } from './registry.js'

const parser = new XMLParser({ removeNSPrefix: true })

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface Favorite {
  title: string
  type: 'station' | 'playlist' | 'album' | 'other'
  uri: string
  albumArtURI: string | null
}

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

const TTL = 300_000 // 5 minutes in milliseconds

let cachedFavorites: Favorite[] | null = null
let cacheTimestamp: number = 0

// ---------------------------------------------------------------------------
// Type classification
// ---------------------------------------------------------------------------

function classifyFavoriteType(upnpClass: string | undefined): Favorite['type'] {
  if (!upnpClass) return 'other'
  if (upnpClass === 'object.item.audioItem.audioBroadcast') return 'station'
  if (upnpClass.includes('playlistContainer')) return 'playlist'
  if (upnpClass.includes('musicAlbum')) return 'album'
  return 'other'
}

// ---------------------------------------------------------------------------
// SOAP ContentDirectory Browse
// ---------------------------------------------------------------------------

async function soapContentDirectory(ip: string): Promise<Favorite[]> {
  const url = `http://${ip}:1400/MediaServer/ContentDirectory/Control`
  const action = 'Browse'
  const envelope = `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
            s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:Browse xmlns:u="urn:schemas-upnp-org:service:ContentDirectory:1">
      <ObjectID>FV:2</ObjectID>
      <BrowseFlag>BrowseDirectChildren</BrowseFlag>
      <Filter>*</Filter>
      <StartingIndex>0</StartingIndex>
      <RequestedCount>100</RequestedCount>
      <SortCriteria></SortCriteria>
    </u:Browse>
  </s:Body>
</s:Envelope>`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset="utf-8"',
      SOAPAction: `"urn:schemas-upnp-org:service:ContentDirectory:1#${action}"`,
    },
    body: envelope,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`SOAP ContentDirectory Browse failed: HTTP ${res.status} — ${text.slice(0, 200)}`)
  }

  const text = await res.text()
  const parsed = parser.parse(text)

  // The Result field is an XML string embedded (escaped) inside the SOAP response
  const resultXml: string | undefined =
    parsed?.Envelope?.Body?.BrowseResponse?.Result

  if (!resultXml) return []

  // Parse the DIDL-Lite XML string a second time
  const didl = parser.parse(resultXml)

  // Items may be nested at various paths depending on the parser's handling
  const rawItems = didl?.['DIDL-Lite']?.item ?? didl?.DIDL_Lite?.item ?? null

  if (!rawItems) return []

  // Normalise: parser returns a plain object when there's only one item
  const items: unknown[] = Array.isArray(rawItems) ? rawItems : [rawItems]

  return items.map((item: unknown): Favorite => {
    const i = item as Record<string, unknown>

    const title = typeof i['title'] === 'string' ? i['title'] : String(i['title'] ?? '')

    // `res` can be a plain string or an object with #text when the parser
    // extracts XML attributes (e.g., protocolInfo) alongside text content
    const resValue = i['res']
    const uri =
      typeof resValue === 'string'
        ? resValue
        : typeof resValue === 'object' && resValue !== null && '#text' in resValue
          ? String((resValue as Record<string, unknown>)['#text'] ?? '')
          : ''

    const rawArt = i['albumArtURI']
    const albumArtURI =
      typeof rawArt === 'string' && rawArt.length > 0
        ? rawArt
        : typeof rawArt === 'object' && rawArt !== null && '#text' in rawArt
          ? String((rawArt as Record<string, unknown>)['#text'] ?? '') || null
          : null

    // upnp:class becomes 'class' after NS prefix removal
    const upnpClass = typeof i['class'] === 'string' ? i['class'] : undefined
    const type = classifyFavoriteType(upnpClass)

    return { title, type, uri, albumArtURI }
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all Sonos favorites from any reachable speaker.
 *
 * Uses an in-memory cache with a 5-minute TTL. Pass `forceRefresh=true` to
 * bypass the cache and fetch fresh data from the Sonos network.
 *
 * If the SOAP call fails but stale cache data exists, the stale cache is
 * returned as a fallback. If no cache exists at all, the error is re-thrown.
 */
export async function fetchFavorites(
  speakers: SpeakerInfo[],
  forceRefresh: boolean = false,
): Promise<Favorite[]> {
  // Return cached data if fresh and not forcing refresh
  if (!forceRefresh && cachedFavorites !== null && Date.now() - cacheTimestamp < TTL) {
    return cachedFavorites
  }

  if (speakers.length === 0) return []

  // Use the first available speaker — favorites are shared across the Sonos network
  const speaker = speakers[0]

  try {
    const favorites = await soapContentDirectory(speaker.ip)
    cachedFavorites = favorites
    cacheTimestamp = Date.now()
    return favorites
  } catch (err) {
    // If we have stale cache, return it as fallback rather than failing
    if (cachedFavorites !== null) {
      return cachedFavorites
    }
    throw err
  }
}
