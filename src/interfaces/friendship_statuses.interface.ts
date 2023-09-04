export interface FriendshipStatus {
    id: number;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}