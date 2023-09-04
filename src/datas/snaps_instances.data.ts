export interface CreateSnapInstanceData {
  snapInstanceShapeId: number;

  users: Array<{
    id: number;
    position: string;
  }>;
}

export interface CreateSnapInstaceUserData {
  userId: number;
  snapInstanceId: number;
  snapInstanceShapePositionId: number;
  isOwner: boolean;
}

export interface DeleteSnapInstanceData {
  key: string;
}

export interface InviteUserToSnapInstanceData {
  key: string;
  userId: number;
  position: string;
}

export interface GetSnapInstanceClientsData {
  key: string;
}

export interface GetSnapInstanceData {
  key: string;
}

export interface JoinSnapInstanceData {
  key: string;
}

export interface LeaveSnapInstanceData {
  key: string;
}
