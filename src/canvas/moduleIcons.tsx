import { Box } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { ComponentType } from 'react';

type IconComponent = ComponentType<{ size?: number; className?: string }>;

const ICONS = LucideIcons as unknown as Record<string, IconComponent>;

/** Resolve nama ikon lucide-react (string, disimpan di ModuleDefinition.icon) jadi komponen React. */
export function ModuleIcon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const Icon = ICONS[name] ?? Box;
  return <Icon size={size} className={className} />;
}
