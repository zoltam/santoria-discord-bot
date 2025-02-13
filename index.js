import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import 'dotenv/config';
import { data as landData, execute as landExecute, autocomplete as landAutocomplete } from './commands/land.js';
import { data as playersData, execute as playersExecute } from './commands/players.js';
import { data as trackData, execute as trackExecute } from './commands/track.js';
import { data as untrackData, execute as untrackExecute, autocomplete as untrackAutocomplete } from './commands/untrack.js';
import { checkTrackers } from './trackers.js';
import { initTrackers } from './trackers.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {
    console.error("Missing environment variables");
    process.exit(1);
}

const commands = [landData, playersData, trackData, untrackData];

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    await initTrackers();
    
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log(commands)
        console.log('Commands registered');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
    
    setInterval(() => checkTrackers(client), 30000);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isAutocomplete()) {
        switch (interaction.commandName) {
            case 'land': return await landAutocomplete(interaction);
            case 'untrack': return await untrackAutocomplete(interaction);
        }
        return;
    }
    
    if (!interaction.isCommand()) return;
    
    switch (interaction.commandName) {
        case 'untrack': await untrackExecute(interaction); break;
        case 'land': await landExecute(interaction); break;
        case 'players': await playersExecute(interaction); break;
        case 'track': await trackExecute(interaction); break;
    }
});


client.login(TOKEN);