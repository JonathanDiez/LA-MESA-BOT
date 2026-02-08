# LA-MESA-BOT

Guía rápida para un bot **100% gratis 24/7** basado en *interactions* usando Cloudflare Workers (sin WebSocket) y el comando `/crearcanal`.

> **Nota de seguridad:** No compartas tu `DISCORD_TOKEN` en mensajes públicos. Revoca el token anterior si ya se filtró.

## ✅ Por qué Cloudflare Workers es gratis y 24/7
- Workers responde por HTTPS a *interactions* (no requiere WebSocket ni *gateway*).
- Permite desplegar un endpoint público sin servidor propio.
- La capa gratuita suele ser suficiente para bots pequeños/medianos.

## 📌 Qué hace el comando `/crearcanal`
1. Crea un canal dentro de la categoría con ID `1470001236228050964`.
2. El nombre del canal usa el **apodo del servidor** (nickname) del usuario mencionado.
3. Aplica permisos para el usuario, staff y roles limitados (R8/R9).
4. Envía un embed automático con el mensaje que pediste.

## 🧰 Requisitos
- Node.js 18+
- Wrangler (CLI de Cloudflare)

```bash
npm install
npm install -g wrangler
```

## 🔑 Variables de entorno
Crea secretos en Cloudflare:

```bash
wrangler secret put DISCORD_TOKEN
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put CLIENT_ID
wrangler secret put CATEGORY_ID
wrangler secret put STAFF_ROLE_ID
# Opcionales (si existen en tu servidor)
wrangler secret put R8_ROLE_ID
wrangler secret put R9_ROLE_ID
```

También puedes crear un archivo local `.dev.vars` para `wrangler dev`:

```dotenv
DISCORD_TOKEN=...
DISCORD_PUBLIC_KEY=...
CLIENT_ID=1470005275518828564
CATEGORY_ID=1470001236228050964
STAFF_ROLE_ID=1363345052109377626
R8_ROLE_ID=
R9_ROLE_ID=
```

## 🧾 Registrar el comando `/crearcanal`
Usa el endpoint de *guild commands* para que el comando aparezca rápido en tu servidor:

```bash
curl -X POST \
  -H "Authorization: Bot $DISCORD_TOKEN" \
  -H "Content-Type: application/json" \
  https://discord.com/api/v10/applications/$CLIENT_ID/guilds/1363344085418512534/commands \
  -d '{
    "name": "crearcanal",
    "description": "Crea un canal privado para un usuario",
    "options": [
      {
        "name": "usuario",
        "description": "Usuario a quien se le creará el canal",
        "type": 6,
        "required": true
      }
    ]
  }'
```

## 🚀 Deploy
1. Revisa `wrangler.toml.example` y copia a `wrangler.toml`.
2. Despliega:

```bash
wrangler deploy
```

3. En el *Developer Portal* de Discord, configura **Interactions Endpoint URL** con la URL de tu Worker.

## 🧠 Notas sobre permisos
- El usuario mencionado recibe permisos completos (leer historial, enviar mensajes, reacciones, adjuntos, stickers y mensajes en hilos).
- El rol staff recibe permisos de lectura y gestión.
- Los roles R8/R9 (si los configuras) pueden **ver el canal y adjuntar**, pero **no leer historial** (Discord no permite adjuntar sin ver el canal).

## 📂 Archivos clave
- `src/worker.js`: lógica principal del bot.
- `wrangler.toml.example`: plantilla de configuración.

---

Si necesitas ajustar IDs o permisos, edita `src/worker.js`.
