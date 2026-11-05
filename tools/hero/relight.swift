// Cinematic hero: cut the person out of each frame, relight with a red key/rim from the left and blue from the right,
// and place them on the right of a blue scene with a red glow and embers. Writes two all-intra clips: as recorded and
// with the person mirrored (the scene and the lights stay put), so the page can turn the head either way.
import AVFoundation
import Vision
import CoreImage
import CoreImage.CIFilterBuiltins

let a = CommandLine.arguments
let src = URL(fileURLWithPath: a[1]), outA = URL(fileURLWithPath: a[2]), outB = URL(fileURLWithPath: a[3]), stillOut = a.count > 4 ? a[4] : nil
let endSec = 2.25
let W: CGFloat = 1600, H: CGFloat = 900
let sRGB = CGColorSpace(name: CGColorSpace.sRGB)!
func col(_ hex: String, _ alpha: CGFloat = 1) -> CIColor { let v = Int(hex, radix: 16)!; return CIColor(red: CGFloat(v >> 16 & 255) / 255, green: CGFloat(v >> 8 & 255) / 255, blue: CGFloat(v & 255) / 255, alpha: alpha, colorSpace: sRGB)! }
let canvas = CGRect(x: 0, y: 0, width: W, height: H)
func radial(_ c: CGPoint, _ r: CGFloat, _ color: CIColor) -> CIImage {
  let f = CIFilter.radialGradient(); f.center = c; f.radius0 = 0; f.radius1 = Float(r); f.color0 = color; f.color1 = CIColor(red: color.red, green: color.green, blue: color.blue, alpha: 0, colorSpace: sRGB)!
  return f.outputImage!.cropped(to: canvas)
}
func over(_ top: CIImage, _ bottom: CIImage) -> CIImage { top.composited(over: bottom) }
func linear(_ p0: CGPoint, _ c0: CIColor, _ p1: CGPoint, _ c1: CIColor) -> CIImage {
  let f = CIFilter.linearGradient(); f.point0 = p0; f.point1 = p1; f.color0 = c0; f.color1 = c1; return f.outputImage!.cropped(to: canvas)
}

// ---------- the scene (static) ----------
var bg = linear(CGPoint(x: 0, y: 300), col("1A2C47"), CGPoint(x: 1600, y: 760), col("5FA4D6"))
bg = over(radial(CGPoint(x: 1450, y: 880), 900, col("9AD6F7", 0.85)), bg)                 // cool sky, top right
// blurred city blocks for depth on the left
for (x, y, w, h, al) in [(60.0, 0.0, 260.0, 760.0, 0.34), (300, 0, 180, 560, 0.24), (520, 0, 240, 820, 0.2), (40, 520, 380, 120, 0.18)] {
  let r = CIImage(color: col("0B1424", CGFloat(al))).cropped(to: CGRect(x: x, y: y, width: w, height: h))
  bg = over(r.applyingGaussianBlur(sigma: 22).cropped(to: canvas), bg)
}
// red light: a hot glow low on the left and a soft streak
bg = over(radial(CGPoint(x: 40, y: 280), 620, col("FF1E44", 0.95)), bg)
let streak = radial(CGPoint(x: 0, y: 0), 300, col("FF3B5C", 0.75)).transformed(by: CGAffineTransform(scaleX: 2.6, y: 0.55).rotated(by: 0.42)).transformed(by: CGAffineTransform(translationX: 40, y: 330))
bg = over(streak.cropped(to: canvas).applyingGaussianBlur(sigma: 28).cropped(to: canvas), bg)
// embers / bokeh
var rng = SystemRandomNumberGenerator()
struct LCG { var s: UInt64; mutating func next() -> Double { s = s &* 6364136223846793005 &+ 1442695040888963407; return Double(s >> 11) / Double(1 << 53) } }
var g = LCG(s: 7)
for i in 0..<26 {
  let x = CGFloat(g.next()) * 820, y = CGFloat(g.next()) * 640 + 40, r = CGFloat(3 + g.next() * 9)
  let hot = i % 3 == 0 ? col("FFB07A", 0.9) : col("FF4A3D", 0.8)
  let dot = CIImage(color: hot).cropped(to: CGRect(x: x, y: y, width: r * 2, height: r * 2)).applyingFilter("CICrop", parameters: [:])
  let disc = radial(CGPoint(x: x + r, y: y + r), r * 1.6, hot)
  bg = over(disc.applyingGaussianBlur(sigma: Double(1 + g.next() * 3)).cropped(to: canvas), bg)
  _ = dot
}
for _ in 0..<10 { // a few large soft bokeh discs in blue
  let x = CGFloat(g.next()) * 1000 + 200, y = CGFloat(g.next()) * 700 + 100, r = CGFloat(18 + g.next() * 40)
  bg = over(radial(CGPoint(x: x, y: y), r, col("A9D8F5", 0.16)).applyingGaussianBlur(sigma: 6).cropped(to: canvas), bg)
}
bg = bg.applyingFilter("CIVignette", parameters: [kCIInputIntensityKey: 0.45, kCIInputRadiusKey: 2.8]).applyingFilter("CIColorControls", parameters: [kCIInputSaturationKey: 1.25]).cropped(to: canvas)

// ---------- video in/out ----------
let asset = AVURLAsset(url: src); let sem = DispatchSemaphore(value: 0)
var track: AVAssetTrack!; var size = CGSize.zero; var fps: Float = 24
Task { track = try! await asset.loadTracks(withMediaType: .video).first!; size = try! await track.load(.naturalSize); fps = try! await track.load(.nominalFrameRate); sem.signal() }; sem.wait()
let reader = try! AVAssetReader(asset: asset)
reader.timeRange = CMTimeRange(start: .zero, end: CMTime(seconds: endSec, preferredTimescale: 600))
let out = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]); reader.add(out)
func writer(_ url: URL) -> (AVAssetWriter, AVAssetWriterInputPixelBufferAdaptor) {
  try? FileManager.default.removeItem(at: url)
  let w = try! AVAssetWriter(outputURL: url, fileType: .mp4); w.shouldOptimizeForNetworkUse = true
  let i = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: W, AVVideoHeightKey: H,
    AVVideoColorPropertiesKey: [AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2, AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2, AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2],
    AVVideoCompressionPropertiesKey: [AVVideoMaxKeyFrameIntervalKey: 1, AVVideoAllowFrameReorderingKey: false, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel, AVVideoAverageBitRateKey: 7_000_000]])
  let ad = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: i, sourcePixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: Int(W), kCVPixelBufferHeightKey as String: Int(H)])
  w.add(i); w.startWriting(); w.startSession(atSourceTime: .zero); return (w, ad)
}
let (wa, aa) = writer(outA), (wb, ab) = writer(outB)
reader.startReading()
let ctx = CIContext(options: [.workingColorSpace: sRGB, .outputColorSpace: sRGB])
let req = VNGeneratePersonSegmentationRequest(); req.qualityLevel = .accurate; req.outputPixelFormat = kCVPixelFormatType_OneComponent8

// Placement: person scaled up and moved to the right; the bottom runs off the frame.
let s = H * 1.12 / size.height
let place = CGAffineTransform(scaleX: s, y: s).concatenating(CGAffineTransform(translationX: 1140 - size.width / 2 * s, y: -H * 0.1))
let mirror = CGAffineTransform(scaleX: -1, y: 1).concatenating(CGAffineTransform(translationX: size.width, y: 0))

func lit(_ frame: CIImage, _ mask: CIImage) -> CIImage {
  // person and mask in canvas space
  let p = frame.transformed(by: place), m = mask.transformed(by: place)
  // grade: deep, contrasty shadows so the coloured lights carry the face
  var graded = p.applyingFilter("CIColorControls", parameters: [kCIInputSaturationKey: 0.55, kCIInputBrightnessKey: -0.14, kCIInputContrastKey: 1.55])
  // light map across the head: hot red from the left, cool cyan-blue from the right
  let lightMap = linear(CGPoint(x: 860, y: 0), col("FF2A40"), CGPoint(x: 1380, y: 0), col("4FA8FF"))
  let tinted = lightMap.applyingFilter("CIHardLightBlendMode", parameters: [kCIInputBackgroundImageKey: graded])
  // keep a little of the skin tone, then sink the shadows into blue
  graded = tinted.applyingFilter("CIDissolveTransition", parameters: [kCIInputTargetImageKey: graded, kCIInputTimeKey: 0.12])
  graded = CIImage(color: col("A9BEDA")).cropped(to: canvas).applyingFilter("CIMultiplyBlendMode", parameters: [kCIInputBackgroundImageKey: graded])
  // a red key on the cheek and jaw on the left
  let key = radial(CGPoint(x: 960, y: 480), 300, col("FF2A40", 0.6))
  graded = key.applyingFilter("CIScreenBlendMode", parameters: [kCIInputBackgroundImageKey: graded])
  let falloff = linear(CGPoint(x: 0, y: 0), col("0A1426"), CGPoint(x: 0, y: 360), col("FFFFFF"))
  graded = falloff.applyingFilter("CIMultiplyBlendMode", parameters: [kCIInputBackgroundImageKey: graded])
  // rim light along the silhouette: red on the left edge, blue on the right
  let inner = m.applyingFilter("CIMorphologyMinimum", parameters: [kCIInputRadiusKey: 14])
  let edge = inner.applyingFilter("CISubtractBlendMode", parameters: [kCIInputBackgroundImageKey: m]).applyingGaussianBlur(sigma: 7).cropped(to: canvas)
  let rimCol = linear(CGPoint(x: 880, y: 0), col("FF2E4A"), CGPoint(x: 1360, y: 0), col("6CC4FF"))
  let rim = rimCol.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: CIImage(color: .clear).cropped(to: canvas), kCIInputMaskImageKey: edge])
  graded = rim.applyingFilter("CIScreenBlendMode", parameters: [kCIInputBackgroundImageKey: graded])
  // soft cut edge, then onto the scene
  let soft = m.applyingFilter("CIMorphologyMinimum", parameters: [kCIInputRadiusKey: 3]).applyingGaussianBlur(sigma: 1.8).cropped(to: canvas)
  return graded.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: bg, kCIInputMaskImageKey: soft]).cropped(to: canvas)
}

var n = 0
while let sb = out.copyNextSampleBuffer() {
  guard let pb = CMSampleBufferGetImageBuffer(sb) else { continue }
  try! VNImageRequestHandler(cvPixelBuffer: pb).perform([req])
  var mask = CIImage(cvPixelBuffer: req.results!.first!.pixelBuffer)
  mask = mask.transformed(by: CGAffineTransform(scaleX: size.width / mask.extent.width, y: size.height / mask.extent.height))
  let frame = CIImage(cvPixelBuffer: pb)
  let t = CMSampleBufferGetPresentationTimeStamp(sb)
  for (img, ad) in [(lit(frame, mask), aa), (lit(frame.transformed(by: mirror), mask.transformed(by: mirror)), ab)] {
    var o: CVPixelBuffer?; CVPixelBufferPoolCreatePixelBuffer(nil, ad.pixelBufferPool!, &o); ctx.render(img, to: o!)
    while !ad.assetWriterInput.isReadyForMoreMediaData { usleep(2000) }
    ad.append(o!, withPresentationTime: t)
  }
  if n == 0, let still = stillOut { let cg = ctx.createCGImage(lit(frame, mask), from: canvas)!; let d = CGImageDestinationCreateWithURL(URL(fileURLWithPath: still) as CFURL, "public.jpeg" as CFString, 1, nil)!; CGImageDestinationAddImage(d, cg, nil); CGImageDestinationFinalize(d) }
  n += 1
  if ProcessInfo.processInfo.environment["STILL"] != nil { break }
}
for (w, ad) in [(wa, aa), (wb, ab)] { ad.assetWriterInput.markAsFinished(); w.finishWriting { sem.signal() }; sem.wait() }
print("frames", n, wa.error?.localizedDescription ?? "ok", wb.error?.localizedDescription ?? "ok")
