"""영수증 검증기 추상화.

실결제 도입 시 GoogleVerifier/AppleVerifier를 추가하고 VERIFIERS에 등록하면
나머지 결제 흐름(멱등성·구독 연장)은 그대로 재사용된다.
"""

from dataclasses import dataclass


@dataclass
class VerifiedReceipt:
    """검증 통과한 영수증에서 추출한 결제 정보"""

    transaction_id: str
    product_id: str
    plan_type: str  # "premium"
    billing_cycle: str  # "monthly" | "annual"


class ReceiptVerificationError(Exception):
    """영수증 검증 실패 (위조·형식 오류 등)"""


class MockVerifier:
    """개발용 가짜 검증기.

    Mock 규칙: 영수증은 "mock:<transaction_id>:<monthly|annual>" 형식의
    비어있지 않은 문자열이어야 한다. 통과 시 plan_type="premium",
    product_id="roame.premium.<cycle>"로 해석한다. 그 외는 전부 실패.
    """

    async def verify(self, receipt: str) -> VerifiedReceipt:
        if not receipt or not isinstance(receipt, str):
            raise ReceiptVerificationError("유효하지 않은 영수증")

        parts = receipt.split(":")
        if (
            len(parts) != 3
            or parts[0] != "mock"
            or not parts[1]
            or parts[2] not in ("monthly", "annual")
        ):
            raise ReceiptVerificationError("유효하지 않은 영수증")

        transaction_id, cycle = parts[1], parts[2]
        return VerifiedReceipt(
            transaction_id=transaction_id,
            product_id=f"roame.premium.{cycle}",
            plan_type="premium",
            billing_cycle=cycle,
        )


# 실결제 도입 시 "google"/"apple" 검증기 추가 (PAYMENT-SECURITY-PLAN 참조)
VERIFIERS: dict[str, MockVerifier] = {"mock": MockVerifier()}
