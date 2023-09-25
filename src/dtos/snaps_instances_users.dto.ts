export interface CreateSnapInstanceUserDto {
  userId: number;
  snapInstanceId: number;
  isOwner: boolean;
}

export interface JoinUserToSnapInstanceDto {
  userId: number;
  key: string;
}

export interface LeaveUserToSnapInstanceDto {
  userId: number;
  key: string;
}

export interface TakeSnapDto {
  key: string;
  userId: number;
}
