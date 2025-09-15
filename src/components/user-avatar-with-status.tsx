import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@/lib/types";

type UserAvatarWithStatusProps = {
  user: User;
  className?: string;
  imageClassName?: string;
};

export function UserAvatarWithStatus({
  user,
  className,
  imageClassName,
}: UserAvatarWithStatusProps) {
  const nameInitials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("");

  return (
    <div className={cn("relative", className)}>
      <Avatar className={imageClassName}>
        <AvatarImage src={user.avatarUrl} alt={user.name} />
        <AvatarFallback>{nameInitials}</AvatarFallback>
      </Avatar>
      <span
        className={cn(
          "absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full border-2 border-background",
          user.status === "online" ? "bg-green-500" : "bg-gray-400"
        )}
      />
    </div>
  );
}
