import { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowNotification(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {showNotification && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 20, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="fixed top-0 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 rounded-full shadow-lg flex items-center gap-3 font-bold text-sm"
          style={{ 
            backgroundColor: isOnline ? '#109e38' : '#ef4444',
            color: 'white'
          }}
        >
          {isOnline ? (
            <>
              <Wifi className="w-4 h-4" />
              <span>Back Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              <span>You are offline</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
