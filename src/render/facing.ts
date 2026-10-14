/** Convert gameplay headings (sin(yaw), -cos(yaw)) to Three.js rotation for negative-Z-facing models. */
export function modelYaw(yaw:number):number{return -yaw;}
/** Only the local visual pose follows unacknowledged mouse input; remote actors stay authoritative. */
export function characterYaw(actorId:number,localId:number,mouseYaw:number,authoritativeYaw:number):number{return actorId===localId?mouseYaw:authoritativeYaw;}
