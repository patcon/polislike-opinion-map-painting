import { twoPropTest } from "reddwarf-ts";

describe("twoPropTest", () => {
    test("calculates correct z-score for basic case", () => {
        const result = twoPropTest(10, 5, 20, 30);
        expect(result).toBeCloseTo(2.4911, 4);
    });

    test("calculates correct z-score when one group has zero successes", () => {
        const result = twoPropTest(0, 5, 20, 30);
        expect(result).toBeCloseTo(-1.5128, 4);
    });

    test("calculates correct z-score when both groups have zero successes", () => {
        const result = twoPropTest(0, 0, 20, 30);
        expect(result).toBeCloseTo(0.2826, 4);
    });

    test("handles the case where piHat equals 1", () => {
        const result = twoPropTest(19, 29, 20, 30);
        expect(result).toBeCloseTo(-0.2826, 4);

        const resultForPiHatEquals1 = twoPropTest(20, 30, 20, 30);
        expect(resultForPiHatEquals1).toBe(0);
    });

    test("calculates correct z-score for large values", () => {
        const result = twoPropTest(450, 300, 500, 400);
        expect(result).toBeCloseTo(5.9952, 4);
    });

    test("applies the +1 adjustment correctly", () => {
        const unadjusted = (succIn, succOut, popIn, popOut) => {
            const pi1 = succIn / popIn;
            const pi2 = succOut / popOut;
            const piHat = (succIn + succOut) / (popIn + popOut);

            if (piHat === 1) return 0;

            return (
                (pi1 - pi2) /
                Math.sqrt(piHat * (1 - piHat) * (1 / popIn + 1 / popOut))
            );
        };

        const rawResult = unadjusted(10, 5, 20, 30);
        const adjustedResult = twoPropTest(10, 5, 20, 30);

        expect(adjustedResult).not.toBeCloseTo(rawResult, 4);

        const manuallyAdjusted = unadjusted(11, 6, 21, 31);
        expect(adjustedResult).toBeCloseTo(manuallyAdjusted, 4);
    });
});
