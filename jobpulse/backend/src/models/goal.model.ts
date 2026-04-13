/**
 * goal service
 * 
 * this file defines the targets to be achieved on the application by a user
 * 
 * function:
 *      - ensures types safety across services, api routes and users
 *      - defines the input, storage and derived data
 */


/*
period duration

define the period to achieve the goal either daily or weekly
*/
export type PeriodType = "daily" | "weekly";

/*
domain model: goals module

function:
    - defines the data type for input, storage and derived data
    - ensure type safety across services, api routes
*/
export interface Goal{

    //data type

    id: string;
    user_id: string;
    period_type: PeriodType;

    //define the base_target i.e. 20 task/day
    target: number

    //define the carryover i.e. remenats from the previous day
    carryover: number;

    //number the user should complete
    effective_target: number;

    active: boolean;
    created_at: string;
}