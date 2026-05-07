import { Router, type IRouter } from "express";

const router: IRouter = Router();

const TUNISIAN_CITIES = [
  { name: "Tunis", lat: 36.8065, lng: 10.1815, governorate: "Tunis" },
  { name: "Sfax", lat: 34.7406, lng: 10.7603, governorate: "Sfax" },
  { name: "Sousse", lat: 35.8245, lng: 10.6346, governorate: "Sousse" },
  { name: "Kairouan", lat: 35.6781, lng: 10.0969, governorate: "Kairouan" },
  { name: "Bizerte", lat: 37.2746, lng: 9.8738, governorate: "Bizerte" },
  { name: "Gabès", lat: 33.8881, lng: 10.0975, governorate: "Gabès" },
  { name: "Ariana", lat: 36.8663, lng: 10.1647, governorate: "Ariana" },
  { name: "Gafsa", lat: 34.425, lng: 8.7842, governorate: "Gafsa" },
  { name: "Monastir", lat: 35.7643, lng: 10.8113, governorate: "Monastir" },
  { name: "Ben Arous", lat: 36.7528, lng: 10.2184, governorate: "Ben Arous" },
  { name: "Kasserine", lat: 35.1676, lng: 8.8365, governorate: "Kasserine" },
  { name: "Médenine", lat: 33.3549, lng: 10.4957, governorate: "Médenine" },
  { name: "Nabeul", lat: 36.4561, lng: 10.7376, governorate: "Nabeul" },
  { name: "Tataouine", lat: 32.9211, lng: 10.4514, governorate: "Tataouine" },
  { name: "Béja", lat: 36.7256, lng: 9.1817, governorate: "Béja" },
  { name: "Jendouba", lat: 36.501, lng: 8.7803, governorate: "Jendouba" },
  { name: "El Kef", lat: 36.1676, lng: 8.7047, governorate: "El Kef" },
  { name: "Mahdia", lat: 35.5047, lng: 11.062, governorate: "Mahdia" },
  { name: "Sidi Bouzid", lat: 35.0382, lng: 9.4849, governorate: "Sidi Bouzid" },
  { name: "Siliana", lat: 36.0839, lng: 9.3715, governorate: "Siliana" },
  { name: "Zaghouan", lat: 36.4023, lng: 10.1428, governorate: "Zaghouan" },
  { name: "Tozeur", lat: 33.9197, lng: 8.1335, governorate: "Tozeur" },
  { name: "Kebili", lat: 33.7049, lng: 8.9716, governorate: "Kébili" },
  { name: "Manouba", lat: 36.808, lng: 10.0968, governorate: "Manouba" },
  { name: "Hammamet", lat: 36.4008, lng: 10.6218, governorate: "Nabeul" },
  { name: "Djerba (Houmt Souk)", lat: 33.8757, lng: 10.8564, governorate: "Médenine" },
  { name: "Zarzis", lat: 33.5039, lng: 11.1122, governorate: "Médenine" },
  { name: "Tabarka", lat: 36.9547, lng: 8.7583, governorate: "Jendouba" },
  { name: "Douz", lat: 33.4547, lng: 9.0218, governorate: "Kébili" },
  { name: "Matmata", lat: 33.5441, lng: 9.9692, governorate: "Gabès" },
];

router.get("/cities", (_req, res): void => {
  res.json({ cities: TUNISIAN_CITIES });
});

export default router;
