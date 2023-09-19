import {
  S3_ACCESS_KEY_ID,
  S3_BUCKET_NAME,
  S3_BUCKET_REGION,
  S3_SECRET_ACCESS_KEY,
} from "@/config";
import { HttpException } from "@/exceptions/HttpException";
import { User } from "@/interfaces/users.interface";
import { Users } from "@/models/users.model";
import {
  GetObjectCommand,
  GetObjectCommandInput,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  credentials: {
    accessKeyId: S3_ACCESS_KEY_ID || "",
    secretAccessKey: S3_SECRET_ACCESS_KEY || "",
  },
  region: S3_BUCKET_REGION,
});

class UserService {
  public async findUserById(id: number): Promise<User> {
    const findOne = await Users.query().whereNotDeleted().findById(id);
    if (!findOne) throw new HttpException(404, "User not found");
    return findOne;
  }

  public async findUserProfilePictureUrlById(userId: number): Promise<string> {
    const findOneUserData = await Users.query()
      .whereNotDeleted()
      .findById(userId);
    if (!findOneUserData) throw new HttpException(404, "User doesn't exist");

    let params: GetObjectCommandInput = {
      Bucket: S3_BUCKET_NAME,
      Key: findOneUserData.profilePicImageKey,
    };

    const command = new GetObjectCommand(params);
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

    return url;
  }
}

export default UserService;
