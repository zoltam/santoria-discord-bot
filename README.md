# Santoria Tracker Discord Bot

A Discord bot specifically designed for the Santoria Minecraft server, providing player tracking and server monitoring features. Built to work with servers using the Squaremap webmap plugin.

## Features

- **Player Tracking**: Receive notifications when specific players come online/offline
- **World Change Detection**: Track movements between Overworld (Atlas) and Spawn World (Aether)
- **Server Monitoring**: View online players with land/nation affiliations
- **Land Information**: Look up land coordinates and online players
- **Persistent Storage**: Trackers survive bot restarts using JSON storage

## Commands

- `/track [player]`: Start tracking a Minecraft player
- `/untrack [player]`: Stop tracking a player
- `/players`: List all online players with location info
- `/land [name]`: Search for land claim information

## Prerequisites

- Node.js v18 or higher
- Discord application with atleast the following permissions:
  applications.commands, Send Messages, Embed Links

## Installation

1. Clone the repository:
```bash
git clone https://github.com/zoltam/santoria-discord-bot.git
cd santoria-discord-bot
```
Install dependencies:
```bash
npm install
```
Copy environment file:
```bash
cp .env.example .env
```
Edit .env with your credentials:
```env
DISCORD_TOKEN='your_bot_token_here'
DISCORD_CLIENT_ID='your_client_id_here'
```
Start the bot:
```bash
node index.js
```

## Disclaimer
This project is an independent development and is not officially affiliated with or endorsed by the Santoria Minecraft server. The bot was created to enhance the player experience on Santoria but can be adapted for other Minecraft servers using the Squaremap plugin.
