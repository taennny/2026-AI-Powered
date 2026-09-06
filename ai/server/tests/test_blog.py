"""AI-3 블로그 생성 — 직렬화(단일/멀티) + 프롬프트 조립 테스트.

OpenAI 호출 없는 순수 함수(serialize/compose)만 검증한다.
"""

import os
import sys

# ai/server 루트를 import 경로에 추가 (conftest 없이도 단독 실행 가능)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from modules import blog  # noqa: E402


def _block(seq, place="스타벅스", category="카페"):
    return {
        "seq": seq,
        "start": "10:00",
        "end": "11:00",
        "place": place,
        "category": category,
        "address": "서울 성동구 성수동",
        "expense": None,
        "photos": 2,
        "memo": None,
    }


SINGLE = {
    "date": "2026-08-05",
    "user": {"nickname": "태윤", "taste_tags": ["카페"]},
    "blocks": [_block(1), _block(2, "을지로 노가리", "음식점")],
}

MULTI = {
    "user": {"nickname": "태윤", "taste_tags": ["여행"]},
    "days": [
        {"date": "2026-08-05", "blocks": [_block(1)]},
        {"date": "2026-08-06", "blocks": [_block(1, "도쿄 카페", "카페")]},
    ],
}


# ── 직렬화 ────────────────────────────────
def test_serialize_single_day():
    out = blog.serialize(SINGLE)
    assert "[날짜]" in out
    assert "1일차" not in out  # 단일 날은 일차 헤더 없음
    assert "스타벅스" in out and "을지로 노가리" in out


def test_serialize_multi_day_has_day_headers():
    out = blog.serialize(MULTI)
    assert "[기간]" in out and "총 2일" in out
    assert "── 1일차" in out and "── 2일차" in out
    assert "도쿄 카페" in out


def test_normalize_days_both_forms():
    assert len(blog._normalize_days(SINGLE)) == 1
    assert len(blog._normalize_days(MULTI)) == 2


def test_has_blocks():
    assert blog._has_blocks(SINGLE) is True
    assert blog._has_blocks(MULTI) is True
    assert blog._has_blocks({"date": "2026-08-05", "blocks": []}) is False
    assert blog._has_blocks({"days": [{"date": "d", "blocks": []}]}) is False


def test_format_date_bad_input_no_crash():
    assert blog._format_date(None) == ""
    assert blog._format_date("not-a-date") == "not-a-date"


# ── 프롬프트 조립 ─────────────────────────
def test_compose_single_has_no_multiday_instruction():
    p = blog.compose_user_prompt(SINGLE, "casual")
    assert "여정" not in p and "하나의 흐름" not in p


def test_compose_multi_has_multiday_instruction():
    p = blog.compose_user_prompt(MULTI, "casual")
    assert "2일간의 여정" in p and "하나의 흐름" in p


def test_compose_injects_style_examples_with_guard():
    p = blog.compose_user_prompt(
        SINGLE, "casual", style_examples=["예전에 성수동 카페 갔던 글이야~"]
    )
    assert "[문체 참고]" in p
    assert "예전에 성수동 카페" in p
    assert "가져오지 말고" in p  # 내용 복제 금지 가드


def test_compose_empty_style_examples_ignored():
    assert "[문체 참고]" not in blog.compose_user_prompt(SINGLE, "casual", style_examples=[])
    assert "[문체 참고]" not in blog.compose_user_prompt(SINGLE, "casual", style_examples=None)


def test_style_examples_count_and_truncation():
    examples = ["가" * 3000, "나글", "다글", "라글", "마글"]  # 5개, 첫 글 3000자
    p = blog.compose_user_prompt(SINGLE, "casual", style_examples=examples)
    # 최대 3개만
    assert "라글" not in p and "마글" not in p
    assert "나글" in p and "다글" in p
    # 첫 글은 1500자로 절단
    assert "가" * blog.STYLE_EXAMPLE_MAX_CHARS in p
    assert "가" * (blog.STYLE_EXAMPLE_MAX_CHARS + 1) not in p


def test_compose_user_note_appended():
    p = blog.compose_user_prompt(SINGLE, "casual", user_note="비가 왔다")
    assert "[작성자 메모]" in p and "비가 왔다" in p
