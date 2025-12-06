class KickClient {
    constructor() {
        this.pusherKey = '32cbd69e4b950bf97679'; // Public Kick Pusher Key
        this.pusherCluster = 'us2';
        this.pusher = null;
        this.channel = null;
        this.chatroomId = null;
    }

    async connect(username, onMessage) {
        // 1. Get Chatroom ID
        try {
            this.chatroomId = await this.getChatroomId(username);
        } catch (e) {
            console.error("Failed to fetch ID", e);
            throw e;
        }

        this.connectById(this.chatroomId, onMessage);
    }

    connectById(id, onMessage) {
        this.chatroomId = id;

        if (this.pusher) {
            this.pusher.disconnect();
        }

        this.pusher = new Pusher(this.pusherKey, {
            cluster: this.pusherCluster,
            encrypted: true,
        });

        const channelName = `chatrooms.${id}.v2`; // v2 is current standard
        console.log(`Subscribing to ${channelName}...`);

        this.channel = this.pusher.subscribe(channelName);

        this.channel.bind('App\\Events\\ChatMessageEvent', (data) => {
            // Robust parsing: Pusher might give an object or a JSON string
            let parsed = data;
            if (typeof data === 'string') {
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    console.error('Failed to parse chat event JSON', e);
                    return;
                }
            }

            console.log('Kick Chat Event:', parsed);

            if (onMessage) {
                onMessage(parsed);
            }
        });

        this.channel.bind('pusher:subscription_succeeded', () => {
            console.log('Subscription Succeeded! Connected to chatroom:', id);
        });
    }

    async getChatroomId(username) {
        // We'll try to fetch from a proxy or direct. 
        // Direct fetch to kick.com/api/v1/channels/{slug} often blocks due to cloudflare.
        // But sometimes it works from browser context if the user has visited kick.com recently.

        const url = `https://kick.com/api/v2/channels/${username}`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            return data.chatroom.id;
        } catch (error) {
            console.warn('Direct fetch failed. Trying fallback or throwing.', error);
            // In a real app we might use a CORS proxy. 
            // For this local tool, we might fallback to asking user.
            throw error;
        }
    }
}
