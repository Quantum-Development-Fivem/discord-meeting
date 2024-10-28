require('dotenv').config();
const { Client, GatewayIntentBits, Events, ButtonBuilder, ActionRowBuilder, ButtonStyle, InteractionType } = require('discord.js');
const axios = require('axios');
const { REST, Routes } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

const WEBHOOK_URL = process.env.WEBHOOK_URL; 
const CLIENT_ID = process.env.CLIENT_ID; 
const GUILD_ID = process.env.GUILD_ID; 

const commands = [
    {
        name: 'reuniao',
        description: 'Convite para a reunião da equipe New Valley',
        options: [
            {
                type: 3, // STRING
                name: 'hora',
                description: 'A hora da reunião (ex: 20:00)',
                required: true,
            },
            {
                type: 3, // STRING
                name: 'dia',
                description: 'O dia da reunião (ex: 2024-11-01)',
                required: true,
            },
        ],
    },
];

const rest = new REST({ version: '9' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Iniciando a atualização dos comandos...');

        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands },
        );

        console.log('Comandos registrados com sucesso!');
    } catch (error) {
        console.error(error);
    }
})();

client.once(Events.ClientReady, () => {
    console.log(`Bot logado como ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.type === InteractionType.ApplicationCommand) {
        if (interaction.commandName === 'reuniao') {
            const hora = interaction.options.getString('hora');
            const dia = interaction.options.getString('dia');

            const dataReuniao = new Date(`${dia}T${hora}:00`);

            const members = await interaction.guild.members.fetch();

            members.forEach(async (member) => {
                if (!member.user.bot) {
                    try {
                        const alreadySent = member.user.dmChannel && (await member.user.dmChannel.messages.fetch({ limit: 1 })).size > 0;
                        if (alreadySent) return;

                        const buttonYes = new ButtonBuilder()
                            .setCustomId('yes')
                            .setLabel('Posso')
                            .setStyle(ButtonStyle.Success);

                        const buttonNo = new ButtonBuilder()
                            .setCustomId('no')
                            .setLabel('Não Posso')
                            .setStyle(ButtonStyle.Danger);

                        const row = new ActionRowBuilder().addComponents(buttonYes, buttonNo);

                        const msg = await member.send({
                            content: `👥 **Reunião da equipe New Valley**\n\nOlá ${member.displayName || member.user.username},\n\nVocê pode participar da próxima reunião da equipe New Valley no dia ${dataReuniao.toLocaleString()}?`,
                            components: [row],
                        });

                        const filter = (interaction) => {
                            return interaction.user.id === member.id; 
                        };

                        const collector = msg.createMessageComponentCollector({ filter });

                        collector.on('collect', async (interaction) => {
                            const response = interaction.customId === 'yes' ? 'Posso' : 'Não Posso';
                            const name = member.displayName || interaction.user.username;
                            await axios.post(WEBHOOK_URL, {
                                content: `O Staff ${name} Vai na reunião? ${response}`,
                            });
                            await interaction.reply({ content: `Obrigado pela sua resposta: ${response}`, ephemeral: true });
                        });

                        collector.on('end', collected => {
                            if (collected.size === 0) {
                                member.send('Nenhuma resposta foi recebida.');
                            }
                        });
                    } catch (error) {
                        console.error(`Não foi possível enviar mensagem a ${member.user.tag}: ${error}`);
                    }
                }
            });

            await interaction.reply({ content: 'Convites enviados!', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);
