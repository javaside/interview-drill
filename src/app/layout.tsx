import './globals.css'
import { NavBar } from './NavBar.js'
export const metadata = { title: '面试刷题' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <NavBar />
        {children}
      </body>
    </html>
  )
}
