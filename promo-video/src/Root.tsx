import { Composition, Still } from "remotion";
import { MERCHANT_TOTAL, MerchantAd } from "./MerchantAd";
import { MerchantCover } from "./MerchantCover";
import { Promo } from "./Promo";
import { Thumbnail } from "./Thumbnail";
import { ThumbnailVertical } from "./ThumbnailVertical";
import { FPS, TOTAL_FRAMES } from "./theme";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="ByioraSteamTutorial"
      component={Promo}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1080}
      height={1920}
    />
    <Composition
      id="ByioraMerchantAd"
      component={MerchantAd}
      durationInFrames={MERCHANT_TOTAL}
      fps={FPS}
      width={1080}
      height={1920}
    />
    <Still
      id="MerchantCover"
      component={MerchantCover}
      width={1080}
      height={1920}
    />
    <Still id="Thumbnail" component={Thumbnail} width={1280} height={720} />
    <Still
      id="ThumbnailVertical"
      component={ThumbnailVertical}
      width={1080}
      height={1920}
    />
  </>
);
