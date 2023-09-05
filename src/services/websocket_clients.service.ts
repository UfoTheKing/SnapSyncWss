import { HttpException } from "@/exceptions/HttpException";
import { Device } from "@/interfaces/devices.interface";
import { User } from "@/interfaces/users.interface";
import { WebsocketClients } from "@/models/websocket_clients.model";

class WebsocketClientService {
  public async endSession(
    user: User,
    device: Device,
    sessionId: string
  ): Promise<void> {
    const findSession = await WebsocketClients.query()
      .whereNotDeleted()
      .findOne({
        userId: user.id,
        deviceId: device.id,
        uuid: sessionId,
      });

    if (!findSession) throw new HttpException(404, "Session not found");

    await WebsocketClients.query().updateAndFetchById(findSession.id, {
      endedAt: new Date(),
    });

    await WebsocketClients.query().deleteById(findSession.id);
  }
}

export default WebsocketClientService;
