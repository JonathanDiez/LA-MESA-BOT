import nacl from "tweetnacl";

const DISCORD_API = "https://discord.com/api/v10";

const PERMISSIONS = {
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  ADD_REACTIONS: 1n << 6n,
  ATTACH_FILES: 1n << 15n,
  EMBED_LINKS: 1n << 14n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
  USE_EXTERNAL_EMOJIS: 1n << 18n,
  USE_EXTERNAL_STICKERS: 1n << 37n,
  MANAGE_MESSAGES: 1n << 13n,
  MANAGE_THREADS: 1n << 34n,
};

function toPermissionString(...perms) {
  return perms.reduce((acc, perm) => acc | perm, 0n).toString();
}

function slugifyChannelName(name) {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 90) || "canal";
}

function getEnvOrThrow(env, key) {
  const value = env[key];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${key}.`);
  }
  return value;
}

async function verifySignature(request, env, body) {
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");
  if (!signature || !timestamp) return false;

  const publicKey = getEnvOrThrow(env, "DISCORD_PUBLIC_KEY");
  const message = new TextEncoder().encode(timestamp + body);
  const signatureBytes = Buffer.from(signature, "hex");
  const publicKeyBytes = Buffer.from(publicKey, "hex");

  return nacl.sign.detached.verify(message, signatureBytes, publicKeyBytes);
}

async function discordRequest(env, path, options = {}) {
  const token = getEnvOrThrow(env, "DISCORD_TOKEN");
  const response = await fetch(`${DISCORD_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discord API error ${response.status}: ${errorText}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function createSupportChannel(env, guildId, targetUserId) {
  const categoryId = getEnvOrThrow(env, "CATEGORY_ID");
  const staffRoleId = getEnvOrThrow(env, "STAFF_ROLE_ID");
  const r8RoleId = env.R8_ROLE_ID;
  const r9RoleId = env.R9_ROLE_ID;

  const member = await discordRequest(
    env,
    `/guilds/${guildId}/members/${targetUserId}`
  );

  const displayName = member.nick || member.user?.username || "usuario";
  const channelName = slugifyChannelName(displayName);

  const overwrites = [
    {
      id: guildId,
      type: 0,
      deny: toPermissionString(PERMISSIONS.VIEW_CHANNEL),
    },
    {
      id: targetUserId,
      type: 1,
      allow: toPermissionString(
        PERMISSIONS.VIEW_CHANNEL,
        PERMISSIONS.SEND_MESSAGES,
        PERMISSIONS.READ_MESSAGE_HISTORY,
        PERMISSIONS.ADD_REACTIONS,
        PERMISSIONS.ATTACH_FILES,
        PERMISSIONS.EMBED_LINKS,
        PERMISSIONS.SEND_MESSAGES_IN_THREADS,
        PERMISSIONS.USE_EXTERNAL_EMOJIS,
        PERMISSIONS.USE_EXTERNAL_STICKERS
      ),
    },
    {
      id: staffRoleId,
      type: 0,
      allow: toPermissionString(
        PERMISSIONS.VIEW_CHANNEL,
        PERMISSIONS.SEND_MESSAGES,
        PERMISSIONS.READ_MESSAGE_HISTORY,
        PERMISSIONS.ADD_REACTIONS,
        PERMISSIONS.ATTACH_FILES,
        PERMISSIONS.EMBED_LINKS,
        PERMISSIONS.MANAGE_MESSAGES,
        PERMISSIONS.MANAGE_THREADS,
        PERMISSIONS.SEND_MESSAGES_IN_THREADS
      ),
    },
  ];

  const limitedRoleAllow = toPermissionString(
    PERMISSIONS.VIEW_CHANNEL,
    PERMISSIONS.SEND_MESSAGES,
    PERMISSIONS.ATTACH_FILES,
    PERMISSIONS.SEND_MESSAGES_IN_THREADS
  );
  const limitedRoleDeny = toPermissionString(PERMISSIONS.READ_MESSAGE_HISTORY);

  if (r8RoleId) {
    overwrites.push({
      id: r8RoleId,
      type: 0,
      allow: limitedRoleAllow,
      deny: limitedRoleDeny,
    });
  }
  if (r9RoleId) {
    overwrites.push({
      id: r9RoleId,
      type: 0,
      allow: limitedRoleAllow,
      deny: limitedRoleDeny,
    });
  }

  return discordRequest(env, `/guilds/${guildId}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: channelName,
      type: 0,
      parent_id: categoryId,
      permission_overwrites: overwrites,
    }),
  });
}

async function sendWelcomeEmbed(env, channelId, targetUserId) {
  const description =
    `**Buenas <@${targetUserId}>,**\n\n` +
    `**Este es tu canal**, por aqui podras preguntar todas las **dudas y problemas** ` +
    `que tengas en la organizacion o con otros compañeros, tambien ` +
    `**este será el medio por el que se te avisará de penalizaciones u otras faltas** ` +
    `que hayas cometido.\n\n` +
    `**Este es un medio seguro al que solo a ti y a los <@&1363345052109377626> ` +
    `se les permite leer el texto que se mande**, los R8 y R9 solo pueden acceder ` +
    `para adjuntar cosas concretas (pero no podran ver los mensajes que hemos ` +
    `enviado tanto tu como nosotros) por lo que puedes estar tranquilo, ` +
    `es un ~~**sitio confidencial**~~.`;

  return discordRequest(env, `/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      embeds: [
        {
          description,
          color: 0x2b2d31,
        },
      ],
    }),
  });
}

async function handleCrearCanal(env, interaction) {
  const guildId = interaction.guild_id;
  const options = interaction.data?.options || [];
  const targetUserId =
    options.find((option) => option.name === "usuario")?.value ||
    options[0]?.value;
  if (!guildId || !targetUserId) {
    throw new Error("Faltan datos del guild o del usuario mencionado.");
  }

  const channel = await createSupportChannel(env, guildId, targetUserId);
  await sendWelcomeEmbed(env, channel.id, targetUserId);

  return {
    content: `Canal creado: <#${channel.id}>`,
    flags: 1 << 6,
  };
}

async function sendFollowup(env, interaction, payload) {
  const applicationId = getEnvOrThrow(env, "CLIENT_ID");
  return discordRequest(
    env,
    `/webhooks/${applicationId}/${interaction.token}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const body = await request.text();
    const isValid = await verifySignature(request, env, body);
    if (!isValid) {
      return new Response("Invalid request signature", { status: 401 });
    }

    const interaction = JSON.parse(body);

    if (interaction.type === 1) {
      return Response.json({ type: 1 });
    }

    if (interaction.type === 2 && interaction.data?.name === "crearcanal") {
      ctx.waitUntil(
        (async () => {
          try {
            const message = await handleCrearCanal(env, interaction);
            await sendFollowup(env, interaction, message);
          } catch (error) {
            await sendFollowup(env, interaction, {
              content: `Error: ${error.message}`,
              flags: 1 << 6,
            });
          }
        })()
      );

      return Response.json({
        type: 5,
        data: { flags: 1 << 6 },
      });
    }

    return Response.json({
      type: 4,
      data: { content: "Comando no reconocido.", flags: 1 << 6 },
    });
  },
};
