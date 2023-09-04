export interface UserDevice {
    id: number;
    userId: number;
    deviceId: number;

    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;

    unarchived: boolean;
}