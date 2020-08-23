import { IGripConfig, Publisher } from '@fanoutio/grip';

export type GripPublisherSpec = string | IGripConfig | IGripConfig[] | Publisher;
