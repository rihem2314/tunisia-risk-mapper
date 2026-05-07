import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import citiesRouter from "./cities.js";
import predictRouter from "./predict.js";
import weatherRouter from "./weather.js";
import recommendRouter from "./recommend.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(citiesRouter);
router.use(weatherRouter);
router.use(predictRouter);
router.use(recommendRouter);

export default router;
