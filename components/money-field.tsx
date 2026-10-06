"use client";
import {Input} from "./ui/input";
import {moneyDraft,moneyDisplay} from "@/lib/money-input";
export function MoneyField({value,onChange,label}:{value:string;onChange:(text:string)=>void;label?:string}){return <Input type="text" inputMode="numeric" autoComplete="off" aria-label={label} value={value} onChange={e=>{const draft=moneyDraft(e.target.value);if(draft!==null)onChange(draft);}} onBlur={e=>onChange(moneyDisplay(e.currentTarget.value))}/>;}
