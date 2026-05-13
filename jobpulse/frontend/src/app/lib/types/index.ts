/**
what this file does:
    - defines the frontend data shapes
    - mirror backend response payload
    - provides reusable shared interface across the app
    - keep the frontend and backend synchronized
 */

export interface User{

    id: string;
    email: string;
    name: string;
    avatar_url: string | null;
    timezone: string;
    notifications_enabled: boolean;
    created_at: string;
}