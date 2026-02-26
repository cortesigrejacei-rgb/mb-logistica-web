
import { supabase } from '../lib/supabaseClient';

export const sendPushNotification = async (
    technicianId: string,
    title: string,
    body: string,
    pushToken?: string
) => {
    if (!technicianId) return;

    try {
        console.log(`[Notification] RPC Call to ${technicianId}: ${title}`);

        // Call the Secure Postgres Function (Bypasses CORS)
        const { data, error } = await supabase.rpc('send_push_notification_rpc', {
            target_id: technicianId,
            title: title,
            body: body
        });

        if (error) {
            console.error('[Notification] RPC Error:', error);
            return { success: false, error: error.message };
        }

        // The RPC function returns a custom JSON structure: { success: boolean, error?: string, data?: any }
        if (data && data.success) {
            console.log('[Notification] RPC Success:', data);
            return { success: true, data: data.data };
        } else {
            console.error('[Notification] RPC Logic Failed:', data);
            return { success: false, error: data?.error || 'Unknown Error from Server' };
        }

    } catch (error: any) {
        console.error('[Notification] System Error:', error);
        return { success: false, error: error.message || JSON.stringify(error) };
    }
};
