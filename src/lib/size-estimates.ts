// Approximate average bytes per beatmap set (derived from a 500-set sample)

export const WITH_VIDEO_TOTAL = 5_097_488_384; // total bytes for sample with video
export const NO_VIDEO_TOTAL = 4_338_417_664; // total bytes for sample without video

export const AVG_BYTES_WITH_VIDEO = WITH_VIDEO_TOTAL / 500; // ~10.43 MB
export const AVG_BYTES_NO_VIDEO = NO_VIDEO_TOTAL / 500; // ~9.08 MB

export function estimateTotalBytes(setCount: number, downloadVideo: boolean): number {
	return Math.round(setCount * (downloadVideo ? AVG_BYTES_WITH_VIDEO : AVG_BYTES_NO_VIDEO));
}
