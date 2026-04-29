// Lazily loads the Razorpay Checkout script and resolves with window.Razorpay.
let razorpayPromise = null;

export function loadRazorpay() {
  if (typeof window !== "undefined" && window.Razorpay) {
    return Promise.resolve(window.Razorpay);
  }
  if (razorpayPromise) return razorpayPromise;
  razorpayPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(window.Razorpay);
    s.onerror = () => {
      razorpayPromise = null;
      reject(new Error("Failed to load Razorpay"));
    };
    document.body.appendChild(s);
  });
  return razorpayPromise;
}
