import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import 'dotenv/config';
import { data as landData, execute as landExecute, autocomplete as landAutocomplete } from './commands/land.js';
import { data as playersData, execute as playersExecute } from './commands/players.js';
import { data as trackData, execute as trackExecute } from './commands/track.js';
import { data as untrackData, execute as untrackExecute, autocomplete as untrackAutocomplete } from './commands/untrack.js';
import { data as repData, execute as repExecute } from './commands/rep.js';
import { data as trackedData, execute as trackedExecute } from './commands/tracked.js';
import { checkTrackers } from './trackers.js';
import { initTrackers } from './trackers.js';
import { getMineflayerBot } from './mineflayerBot.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const MINECRAFT_USERNAME = process.env.MINECRAFT_USERNAME || 'SantoriaDiscordBot';
const ENABLE_MINEFLAYER = process.env.ENABLE_MINEFLAYER === 'true'; // Read the toggle

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
    console.error("Missing Discord environment variables (TOKEN, CLIENT_ID, or GUILD_ID)");
    process.exit(1);
}

const commands = [landData, playersData, trackData, untrackData, repData, trackedData];

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    await initTrackers();
    
    // Conditionally start periodic reputation updates
    if (ENABLE_MINEFLAYER) {
        const bot = getMineflayerBot();
        bot.startPeriodicUpdates().catch(error => {
            console.error("Failed to start reputation updates:", error);
        });
    } else {
        console.log('Mineflayer features are disabled.');
    }
    
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    console.log('Attempting to register slash commands...');
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log('Successfully registered slash commands for the guild.');
    } catch (error) {
        console.error('Error registering guild commands:', error);
        if (error.rawError) {
            console.error('Discord API Error Details:', error.rawError);
        }
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
        case 'rep': await repExecute(interaction); break;
        case 'tracked': await trackedExecute(interaction); break;
    }
});

// Handle process exit
process.on('SIGINT', () => {
    console.log('Shutting down...');
    if (ENABLE_MINEFLAYER) {
        const bot = getMineflayerBot();
        bot.stop();
    }
    process.exit(0);
});

client.login(TOKEN);
