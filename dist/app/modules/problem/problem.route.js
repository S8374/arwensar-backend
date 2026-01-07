"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProblemRoutes = void 0;
// src/modules/problem/problem.route.ts
const express_1 = __importDefault(require("express"));
const problem_controller_1 = require("./problem.controller");
const problem_constant_1 = require("./problem.constant");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const planLimitMiddleware_1 = require("../../middlewares/planLimitMiddleware");
const router = express_1.default.Router();
// Create problem
router.post("/", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), (0, planLimitMiddleware_1.checkUsage)('reportCreate', 1), problem_controller_1.ProblemController.createProblem);
// Get problems
router.get("/", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), problem_controller_1.ProblemController.getProblems);
// Get problem by ID
router.get("/:problemId", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), problem_controller_1.ProblemController.getProblemById);
// Update problem
router.patch("/:problemId", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), (0, validateRequest_1.default)(problem_constant_1.updateProblemSchema), problem_controller_1.ProblemController.updateProblem);
// Create message
router.post("/:problemId/messages", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), (0, planLimitMiddleware_1.checkUsage)('messagesUsed', 1), (0, validateRequest_1.default)(problem_constant_1.createMessageSchema), problem_controller_1.ProblemController.createMessage);
// Get problem statistics
router.get("/statistics", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), problem_controller_1.ProblemController.getProblemStatistics);
// Delete problem
router.delete("/:problemId", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), problem_controller_1.ProblemController.deleteProblem);
exports.ProblemRoutes = router;
