/*
handles motivational quote generations used for notifications

what it does:
    - generate short motivational quote using gemini
    - adjust tone based on time of the day
    - uses user progress data for quotes
    - use hardcode quotes if ai fail
*/


import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../core/config";


export type QuoteTone = "night" | "morning" | "afternoon" | "evening";

//gemini setup
const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
const model = genAI.getGenerativeModel({model: config.gemini.model});

