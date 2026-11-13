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

// A 256x1 colour ramp for CIColorMap: brightness in, colour out.
func ramp(_ stops: [(CGFloat, String)]) -> CIImage {
  let ctxG = CGContext(data: nil, width: 256, height: 1, bitsPerComponent: 8, bytesPerRow: 0, space: sRGB, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  func rgb(_ h: String) -> (CGFloat, CGFloat, CGFloat) { let v = Int(h, radix: 16)!; return (CGFloat(v >> 16 & 255) / 255, CGFloat(v >> 8 & 255) / 255, CGFloat(v & 255) / 255) }
  for x in 0..<256 {
    let t = CGFloat(x) / 255
    var i = 0; while i < stops.count - 2 && t > stops[i + 1].0 { i += 1 }
    let (t0, c0) = stops[i], (t1, c1) = stops[i + 1], k = max(0, min(1, (t - t0) / max(t1 - t0, 0.0001)))
    let a = rgb(c0), b = rgb(c1)
    ctxG.setFillColor(red: a.0 + (b.0 - a.0) * k, green: a.1 + (b.1 - a.1) * k, blue: a.2 + (b.2 - a.2) * k, alpha: 1)
    ctxG.fill(CGRect(x: x, y: 0, width: 1, height: 1))
  }
  return CIImage(cgImage: ctxG.makeImage()!)
}
// Key side (left): shadows sink to navy, lit skin goes hot red. Far side (right): highlights go cyan-blue.
let mapRed = ramp([(0, "070B14"), (0.22, "1A2232"), (0.42, "55283A"), (0.62, "B83E52"), (0.8, "EC6A62"), (0.93, "FBA28E"), (1, "FFE3D8")])
let mapBlue = ramp([(0, "070B14"), (0.22, "16223A"), (0.45, "2C4C72"), (0.68, "5C8FC4"), (0.86, "A3CDF0"), (1, "EAF5FF")])

struct LCG { var s: UInt64; mutating func next() -> Double { s = s &* 6364136223846793005 &+ 1442695040888963407; return Double(s >> 11) / Double(1 << 53) } }
// ---------- the scene (static) ----------
// THEME=light: a soft pastel studio (sky to blush, pastel bokeh). Otherwise the dark cinematic scene.
let lightTheme = ProcessInfo.processInfo.environment["THEME"] == "light"
var bg: CIImage
if lightTheme {
  bg = linear(CGPoint(x: 0, y: 200), col("FBEFF2"), CGPoint(x: 1600, y: 800), col("E4EEFB"))
  bg = over(radial(CGPoint(x: 1380, y: 820), 900, col("D6E7FA", 0.9)), bg)              // cool light, top right
  bg = over(radial(CGPoint(x: 120, y: 240), 700, col("FCDDE3", 0.85)), bg)              // warm blush, low left
  bg = over(radial(CGPoint(x: 700, y: 900), 520, col("EEE7FB", 0.7)), bg)               // lavender, top middle
  var g2 = LCG(s: 11)
  for i in 0..<16 { // soft pastel bokeh
    let x = CGFloat(g2.next()) * 1000 + 40, y = CGFloat(g2.next()) * 760 + 60, r = CGFloat(14 + g2.next() * 46)
    let c = [col("F7C6D0", 0.35), col("C9DDF6", 0.4), col("DCD2F5", 0.35), col("FFE2C7", 0.35)][i % 4]
    bg = over(radial(CGPoint(x: x, y: y), r, c).applyingGaussianBlur(sigma: 5).cropped(to: canvas), bg)
  }
} else {
bg = linear(CGPoint(x: 0, y: 300), col("1A2C47"), CGPoint(x: 1600, y: 760), col("5FA4D6"))
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

}

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

// Returns the lit person and their soft cut-out mask, in canvas space.
// k: 0 facing front .. 1 at profile. The red key falls on the side the face turns toward and grows with the turn,
// so facing front is lit evenly and the mirrored clip matches it at the hand-off.
func lit(_ frame: CIImage, _ mask: CIImage, _ k: CGFloat) -> (CIImage, CIImage) {
  let p = frame.transformed(by: place), m = mask.transformed(by: place)
  let lum = p.applyingFilter("CIColorControls", parameters: [kCIInputSaturationKey: 0, kCIInputBrightnessKey: 0, kCIInputContrastKey: 1.12])
    .applyingFilter("CIGammaAdjust", parameters: ["inputPower": 1.12])
  let red = lum.applyingFilter("CIColorMap", parameters: ["inputGradientImage": mapRed])
  let blue = lum.applyingFilter("CIColorMap", parameters: ["inputGradientImage": mapBlue])
  let split = linear(CGPoint(x: 1050, y: 0), col("FFFFFF"), CGPoint(x: 1300, y: 0), col("000000"))
  let even = CIImage(color: col("808080")).cropped(to: canvas)
  let side = even.applyingFilter("CIDissolveTransition", parameters: [kCIInputTargetImageKey: split, kCIInputTimeKey: k])
  let mapped = red.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: blue, kCIInputMaskImageKey: side])
  // mostly the real skin, coloured by the two lights
  let natural = p.applyingFilter("CIColorControls", parameters: [kCIInputSaturationKey: 0.9, kCIInputBrightnessKey: -0.08, kCIInputContrastKey: 1.08])
  var graded = mapped.applyingFilter("CIDissolveTransition", parameters: [kCIInputTargetImageKey: natural, kCIInputTimeKey: lightTheme ? 0.62 : 0.36])
  let falloff = linear(CGPoint(x: 0, y: 0), col(lightTheme ? "C9D3E6" : "1A2840"), CGPoint(x: 0, y: 330), col("FFFFFF"))
  graded = falloff.applyingFilter("CIMultiplyBlendMode", parameters: [kCIInputBackgroundImageKey: graded])
  // a thin, soft rim: warm on the key side, cool behind
  let inner = m.applyingFilter("CIMorphologyMinimum", parameters: [kCIInputRadiusKey: 8])
  let edge = inner.applyingFilter("CISubtractBlendMode", parameters: [kCIInputBackgroundImageKey: m]).applyingGaussianBlur(sigma: 4).cropped(to: canvas)
  let rimCol = linear(CGPoint(x: 1000, y: 0), col("FF5A5E", lightTheme ? 0.4 : 0.75), CGPoint(x: 1300, y: 0), col("8FD2FF", lightTheme ? 0.4 : 0.65))
  let rim = rimCol.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: CIImage(color: .clear).cropped(to: canvas), kCIInputMaskImageKey: edge])
  graded = rim.applyingFilter("CIScreenBlendMode", parameters: [kCIInputBackgroundImageKey: graded])
  let soft = m.applyingFilter("CIMorphologyMinimum", parameters: [kCIInputRadiusKey: 3]).applyingGaussianBlur(sigma: 1.8).cropped(to: canvas)
  return (graded.cropped(to: canvas), soft)
}
func onScene(_ person: CIImage, _ soft: CIImage) -> CIImage {
  person.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: bg, kCIInputMaskImageKey: soft]).cropped(to: canvas)
}
// The mirrored clip flips the lit person (light and all) about the face, on the same scene.
let flip = CGAffineTransform(a: -1, b: 0, c: 0, d: 1, tx: 2 * 1140, ty: 0)
let total = max(1, Int((endSec * Double(fps)).rounded()) - 1)

var n = 0
while let sb = out.copyNextSampleBuffer() {
  guard let pb = CMSampleBufferGetImageBuffer(sb) else { continue }
  try! VNImageRequestHandler(cvPixelBuffer: pb).perform([req])
  var mask = CIImage(cvPixelBuffer: req.results!.first!.pixelBuffer)
  mask = mask.transformed(by: CGAffineTransform(scaleX: size.width / mask.extent.width, y: size.height / mask.extent.height))
  let frame = CIImage(cvPixelBuffer: pb)
  let t = CMSampleBufferGetPresentationTimeStamp(sb)
  let k = CGFloat(min(1, Double(n) / Double(total)))
  let (person, soft) = lit(frame, mask, k)
  let imgA = onScene(person, soft), imgB = onScene(person.transformed(by: flip).cropped(to: canvas), soft.transformed(by: flip).cropped(to: canvas))
  for (img, ad) in [(imgA, aa), (imgB, ab)] {
    var o: CVPixelBuffer?; CVPixelBufferPoolCreatePixelBuffer(nil, ad.pixelBufferPool!, &o); ctx.render(img, to: o!)
    while !ad.assetWriterInput.isReadyForMoreMediaData { usleep(2000) }
    ad.append(o!, withPresentationTime: t)
  }
  if n == Int(ProcessInfo.processInfo.environment["STILLN"] ?? "0")!, let still = stillOut { let cg = ctx.createCGImage(imgA, from: canvas)!; let d = CGImageDestinationCreateWithURL(URL(fileURLWithPath: still) as CFURL, "public.jpeg" as CFString, 1, nil)!; CGImageDestinationAddImage(d, cg, nil); CGImageDestinationFinalize(d) }
  n += 1
  if ProcessInfo.processInfo.environment["STILL"] != nil && n > Int(ProcessInfo.processInfo.environment["STILLN"] ?? "0")! { break }
}
for (w, ad) in [(wa, aa), (wb, ab)] { ad.assetWriterInput.markAsFinished(); w.finishWriting { sem.signal() }; sem.wait() }
print("frames", n, wa.error?.localizedDescription ?? "ok", wb.error?.localizedDescription ?? "ok")
