import type { Metadata } from "next";
import KeychainDesigner from "./KeychainDesigner";
export const metadata: Metadata = { title: "ออกแบบพวงกุญแจ | K2STUDIO", robots: { index: false, follow: false } };
export default function Page() { return <KeychainDesigner/>; }
