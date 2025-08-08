import { Search, ChartLine, Wallet, User } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Header() {
  return (
    <header className="glass-effect border-b border-gray-700 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <ChartLine className="text-neon-green text-2xl" />
              <h1 className="text-2xl font-bold text-neon-green glow-text">CryptoTrader Pro</h1>
            </div>
            
            <nav className="hidden md:flex space-x-6">
              <a href="#" className="text-gray-300 hover:text-neon-cyan transition-colors">Dashboard</a>
              <a href="#" className="text-gray-300 hover:text-neon-cyan transition-colors">Portfolio</a>
              <a href="#" className="text-gray-300 hover:text-neon-cyan transition-colors">Markets</a>
              <a href="#" className="text-gray-300 hover:text-neon-cyan transition-colors">Trading</a>
              <a href="#" className="text-gray-300 hover:text-neon-cyan transition-colors">Analytics</a>
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Input 
                type="text" 
                placeholder="Search cryptocurrencies..." 
                className="glass-effect border-none focus:ring-2 focus:ring-neon-cyan w-64 pl-10"
              />
              <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="glass-effect rounded-lg px-3 py-2">
                <Wallet className="text-neon-green mr-2 inline w-4 h-4" />
                <span className="text-sm font-medium">$12,459.32</span>
              </div>
              <div className="w-8 h-8 bg-neon-pink rounded-full flex items-center justify-center">
                <User className="text-white w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
