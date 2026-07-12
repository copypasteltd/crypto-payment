import React from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { Button } from './ui/Common.tsx';

const connector = injected();

type WalletButtonProps = {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  connectLabel: string;
  disconnectLabel: string;
};

export const WalletButton: React.FC<WalletButtonProps> = ({
  className = '',
  size = 'md',
  connectLabel,
  disconnectLabel,
}) => {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const short = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

  if (!isConnected) {
    return (
      <Button className={className} size={size} onClick={() => connect({ connector })} isLoading={isPending}>
        {connectLabel}
      </Button>
    );
  }

  return (
    <Button className={className} size={size} variant="outline" onClick={() => disconnect()}>
      {disconnectLabel} {short}
    </Button>
  );
};
