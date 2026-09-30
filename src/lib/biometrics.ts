/**
 * Biometric utilities — wraps face-api.js for face embedding generation.
 * For fingerprint and iris we produce simulated random feature vectors
 * (labelled as simulated throughout the UI).
 *
 * Raw images are never persisted — vectors are generated client-side and
 * the image reference is discarded immediately after.
 */

/** Generate a normalised random vector of given dimensionality */
function randomVector(dims: number): number[] {
  const v: number[] = Array.from({ length: dims }, () => (Math.random() * 2 - 1))
  const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
  return v.map(x => x / mag)
}

/**
 * Produce a simulated face embedding from an HTMLVideoElement or HTMLImageElement.
 * In production replace the body with a real face-api.js call:
 *
 *   await faceapi.nets.faceRecognitionNet.loadFromUri('/models')
 *   const detection = await faceapi.detectSingleFace(el).withFaceLandmarks().withFaceDescriptor()
 *   return Array.from(detection.descriptor)
 *
 * We return a 128-d vector — same dimensionality as face-api's FaceRecognitionNet.
 */
export async function extractFaceEmbedding(
  _el: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<number[]> {
  // Simulate ~100 ms processing delay
  await new Promise(r => setTimeout(r, 120))
  return randomVector(128)
}

/** Simulated fingerprint feature vector (256-d) */
export async function extractFingerprintVector(): Promise<number[]> {
  await new Promise(r => setTimeout(r, 80))
  return randomVector(256)
}

/** Simulated iris feature vector (512-d) */
export async function extractIrisVector(): Promise<number[]> {
  await new Promise(r => setTimeout(r, 80))
  return randomVector(512)
}

/** Cosine similarity (client-side, for display preview only) */
export function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, ma = 0, mb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; ma += a[i] ** 2; mb += b[i] ** 2
  }
  const d = Math.sqrt(ma) * Math.sqrt(mb)
  return d === 0 ? 0 : dot / d
}
