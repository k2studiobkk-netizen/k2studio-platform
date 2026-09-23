import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./hardware-catalog.css";
import StaffAiAssistant from "./admin/StaffAiAssistant";
import StaffHelpGuide from "./admin/StaffHelpGuide";

export const metadata: Metadata = {
  metadataBase:new URL("https://order.k2group.site"),
  applicationName:"K2 Order",
  title:"K2STUDIO | สินค้าพรีเมียม ของแจก และสินค้าติดแบรนด์",
  description:"รับผลิตสินค้าพรีเมียม ของแจก และสินค้าติดแบรนด์ เริ่ม Custom ได้ตั้งแต่ 1 ชิ้น โดยทีม K2STUDIO",
  manifest:"/manifest.webmanifest",
  appleWebApp:{capable:true,title:"K2 Order",statusBarStyle:"black-translucent"},
  formatDetection:{telephone:false},
  icons:{
    icon:[
      {url:"/icons/k2studio-192.png",sizes:"192x192",type:"image/png"},
      {url:"/icons/k2studio-512.png",sizes:"512x512",type:"image/png"}
    ],
    apple:[{url:"/icons/apple-touch-icon.png",sizes:"180x180",type:"image/png"}]
  },
  openGraph:{
    title:"K2STUDIO — สินค้าสั่งทำที่พูดแทนแบรนด์ของคุณ",
    description:"พวงกุญแจ เสื้อ หมวก กระเป๋า แก้ว และของพรีเมียม เริ่มได้ตั้งแต่ 1 ชิ้น",
    url:"https://order.k2group.site",
    siteName:"K2STUDIO",
    locale:"th_TH",
    type:"website",
    images:[{url:"/og-k2studio.png",secureUrl:"https://order.k2group.site/og-k2studio.png",width:1200,height:630,type:"image/png",alt:"K2STUDIO สินค้าสั่งทำและของพรีเมียม"}]
  },
  twitter:{card:"summary_large_image",title:"K2STUDIO | Premium Custom Products",description:"สินค้าพรีเมียม ของแจก และสินค้าติดแบรนด์ เริ่ม 1 ชิ้น",images:["/og-k2studio.png"]}
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#111111",
};
export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="th">
    <head><meta name="apple-mobile-web-app-capable" content="yes"/></head>
    <body>{children}<StaffHelpGuide/><StaffAiAssistant/></body>
  </html>;
}
