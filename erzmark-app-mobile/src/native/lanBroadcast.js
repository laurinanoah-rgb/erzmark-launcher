import dgram from "react-native-udp";

/**
 * Bedrock-LAN-Discovery-Responder (26.07.2026, "Connect"-Feature v2).
 *
 * Ersetzt den urspruenglich geplanten zentralen DNS-Redirect (siehe
 * PLANNING.md, "Connect"-Feature) - Nutzerwunsch: Erzmark soll wie eine
 * "LAN-Welt" automatisch in der Bedrock-Serverliste der Konsole auftauchen,
 * ohne manuelle DNS-Einstellungen. Bedrock-Konsolen entdecken LAN-Welten,
 * indem sie einen RakNet "Unconnected Ping" per UDP-Broadcast auf Port 19132
 * ins lokale Netz schicken - jedes Geraet, das mit einem "Unconnected Pong"
 * antwortet, erscheint automatisch in der Liste. Funktioniert NUR im selben
 * WLAN (kein Internet/DNS involviert), und nur solange die App im
 * Vordergrund offen ist (kein Hintergrund-Listening auf iOS/Android geplant).
 *
 * WICHTIG - Aktueller Stand (Phase 1 von 2): Dieses Modul macht das Handy nur
 * SICHTBAR in der LAN-Liste (Ping/Pong-Handshake). Es implementiert NICHT den
 * vollen RakNet-Verbindungsaufbau + das "Transfer"-Paket, das die Konsole nach
 * dem Antippen tatsaechlich zum echten Server (162.55.27.161:19132)
 * umleiten wuerde - das ist echtes Bedrock-Protokoll-Reverse-Engineering
 * (Verbindungs-Handshake, Reliability-Layer, komprimiertes Login-Paket) und
 * laesst sich ohne eine echte Konsole zum Testen nicht blind sicher
 * implementieren. Naechster Schritt laut Absprache: erst pruefen, ob "Erzmark"
 * auf einer echten Konsole im LAN-Tab auftaucht, danach Phase 2 angehen.
 *
 * Protokollwerte (Protokollversion 1001, Version "26.33", Gamemode Survival)
 * live vom echten Server erzmark.de:19132 abgefragt (26.07.2026), nicht
 * geraten - siehe Session-Log.
 */

const RAKNET_MAGIC = Buffer.from([
  0x00, 0xff, 0xff, 0x00, 0xfe, 0xfe, 0xfe, 0xfe, 0xfd, 0xfd, 0xfd, 0xfd, 0x12, 0x34, 0x56, 0x78,
]);
const ID_UNCONNECTED_PING = 0x01;
const ID_UNCONNECTED_PING_OPEN_CONNECTIONS = 0x02;
const ID_UNCONNECTED_PONG = 0x1c;
const RAKNET_PORT = 19132;

// Fester, frei erfundener 64-Bit-Server-GUID - muss nur vorhanden/eindeutig
// genug sein, hat keinen Bezug zum echten Server-GUID von erzmark.de.
const SERVER_GUID = 7318442190385716224n;

function buildMotd() {
  const fields = [
    "MCPE",
    "Erzmark",
    "1001",
    "26.33",
    "0",
    "100",
    SERVER_GUID.toString(),
    "Tippen zum Verbinden",
    "Survival",
    "1",
    String(RAKNET_PORT),
    String(RAKNET_PORT),
  ];
  return fields.join(";") + ";";
}

function buildPong(pingTime) {
  const motd = Buffer.from(buildMotd(), "utf8");
  const packet = Buffer.alloc(1 + 8 + 8 + 16 + 2 + motd.length);
  let off = 0;
  packet.writeUInt8(ID_UNCONNECTED_PONG, off); off += 1;
  packet.writeBigInt64BE(pingTime, off); off += 8;
  packet.writeBigInt64BE(SERVER_GUID, off); off += 8;
  RAKNET_MAGIC.copy(packet, off); off += 16;
  packet.writeUInt16BE(motd.length, off); off += 2;
  motd.copy(packet, off);
  return packet;
}

/** @returns {{ pingTime: bigint } | null} */
function parsePing(msg) {
  if (msg.length < 1 + 8 + 16) return null;
  const id = msg.readUInt8(0);
  if (id !== ID_UNCONNECTED_PING && id !== ID_UNCONNECTED_PING_OPEN_CONNECTIONS) return null;
  const magic = msg.subarray(9, 25);
  if (!magic.equals(RAKNET_MAGIC)) return null;
  return { pingTime: msg.readBigInt64BE(1) };
}

let socket = null;

/** @returns {Promise<void>} - lehnt ab, falls Port 19132 nicht gebunden werden kann. */
export function startLanBroadcast() {
  return new Promise((resolve, reject) => {
    if (socket) {
      resolve();
      return;
    }

    // reusePort war hier vorher gesetzt, ist auf Android in react-native-udp aber
    // schlecht getestet (mehrere gemeldete Release-Build-Abstuerze/kryptische native
    // Fehler damit) - wir brauchen es ohnehin nicht (nur eine Bind-Instanz pro App).
    const s = dgram.createSocket({ type: "udp4" });
    let settled = false;

    s.once("error", (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
      stopLanBroadcast();
    });

    s.once("listening", () => {
      s.setBroadcast(true);
      socket = s;
      if (!settled) {
        settled = true;
        resolve();
      }
    });

    s.on("message", (msg, rinfo) => {
      const ping = parsePing(msg);
      if (!ping) return;
      const pong = buildPong(ping.pingTime);
      s.send(pong, 0, pong.length, rinfo.port, rinfo.address);
    });

    s.bind(RAKNET_PORT);
  });
}

export function stopLanBroadcast() {
  if (!socket) return;
  try {
    socket.close();
  } catch {
    // Socket war bereits zu/kaputt - egal, wir setzen den Zustand trotzdem zurueck.
  }
  socket = null;
}

export function isLanBroadcastActive() {
  return socket !== null;
}
