export type CheckoutItem = {
  id: string;
  name: string;
  price: string;
  image: string;
  type: "skin" | "board" | "emote" | "coins" | "pass" | "pro";
};

export const checkoutItems: Record<string, CheckoutItem> = {
  "neon-skin": { id: "neon-skin", name: "Neon Skin", price: "$4.99", image: "♕♘", type: "skin" },
  "gold-skin": { id: "gold-skin", name: "Gold Skin", price: "$6.99", image: "♛♞", type: "skin" },
  "wood-skin": { id: "wood-skin", name: "Wood Skin", price: "$5.99", image: "♜♟", type: "skin" },
  "tengri-skin": { id: "tengri-skin", name: "Tengri Blue Skin", price: "$5.99", image: "♕♞", type: "skin" },
  "steppe-skin": { id: "steppe-skin", name: "Steppe Nomad Skin", price: "$5.49", image: "♜♟", type: "skin" },
  "yurt-skin": { id: "yurt-skin", name: "Yurt Ivory Skin", price: "$6.49", image: "♔♛", type: "skin" },
  "chesscom-board": { id: "chesscom-board", name: "Chess.com Green Board", price: "$3.99", image: "▦", type: "board" },
  "midnight-board": { id: "midnight-board", name: "Midnight Glass Board", price: "$4.99", image: "▦", type: "board" },
  "emerald-board": { id: "emerald-board", name: "Emerald Club Board", price: "$5.99", image: "▦", type: "board" },
  "carbon-board": { id: "carbon-board", name: "Carbon Arena Board", price: "$6.99", image: "▦", type: "board" },
  "gg-emotes": { id: "gg-emotes", name: "GG Pack", price: "$1.99", image: "GG", type: "emote" },
  "chaos-emotes": { id: "chaos-emotes", name: "Chaos Reactions", price: "$2.49", image: "ϟ", type: "emote" },
  "kazakh-emotes": { id: "kazakh-emotes", name: "Kazakh Hype", price: "$2.99", image: "KZ", type: "emote" },
  "starter-coins": { id: "starter-coins", name: "Starter Coins", price: "$2.99", image: "+500", type: "coins" },
  "club-stack": { id: "club-stack", name: "Club Stack", price: "$6.99", image: "+1400", type: "coins" },
  "founder-vault": { id: "founder-vault", name: "Founder Vault", price: "$14.99", image: "+3600", type: "coins" },
  "chaos-pass": { id: "chaos-pass", name: "Chaos Pass", price: "$7.99", image: "♛", type: "pass" },
  "pro-vip": { id: "pro-vip", name: "VIP", price: "$4.99/month", image: "♙", type: "pro" },
  "pro-plus": { id: "pro-plus", name: "PLUS", price: "$6.99/month", image: "♘", type: "pro" },
  "pro-premium": { id: "pro-premium", name: "PREMIUM", price: "$9.99/month", image: "♕", type: "pro" },
  "pro-pro": { id: "pro-pro", name: "PRO", price: "$14.99/month", image: "♛", type: "pro" },
};
