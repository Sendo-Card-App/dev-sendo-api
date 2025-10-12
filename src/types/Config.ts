import { TypesConfig } from "@utils/constants";
import { BaseEntity } from "./BaseEntity";

export interface Config extends BaseEntity {
    name: TypesConfig;
    value: number;
    description: string;
}