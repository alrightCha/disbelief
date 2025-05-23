import axios from "axios";

export enum NotificationEvent {
    Sale = "Sale", 
    Buy = "Buy", 
    Stop = "Stopped sniping"
}

const TG_BOT_URL = "http://127.0.0.1:8000/notify";

//TODO: Implement notif call to tg bot endpoint 
export const notifyTGUser = async (userId: number, message: string, event: NotificationEvent, mint: string, amount: number) => {
    try {
        const payload = {
            user_id: userId,
            message,
            event,
            mint, 
            amount
        };
        const response = await axios.post(TG_BOT_URL, payload);
        return response.data; // Optionally return the bot's reply
    } catch (err: any) {
        console.error("Failed to notify TG user:", err?.message || err);
        return null;
    }
};