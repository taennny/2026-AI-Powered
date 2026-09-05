import {View, Text, TouchableOpacity} from 'react-native';

/**
 * 설정 화면 하단의 텍스트 액션 묶음 (로그아웃/회원탈퇴, 결제 수단 변경/구독 해지).
 *
 * **자리 잡기는 호출부가 한다** — 계정은 `absolute`, 구독은 `mt-auto`로 서로 다르다.
 * 여기서 맞추는 건 간격과 글씨뿐이다.
 */

type Tone = 'default' | 'muted';

export type SettingsAction = {
  label: string;
  onPress: () => void;
  /** 되돌리기 어렵거나 부차적인 동작은 muted (회원탈퇴, 구독 해지) */
  tone?: Tone;
};

type Props = {
  actions: SettingsAction[];
  /** 위치 지정용 — `absolute bottom-20 left-6`, `mt-auto pb-20` 등 */
  className?: string;
};

export default function SettingsActions({actions, className = ''}: Props) {
  return (
    <View className={`gap-y-[9px] ${className}`}>
      {actions.map(({label, onPress, tone = 'default'}) => (
        <TouchableOpacity key={label} onPress={onPress} activeOpacity={0.6}>
          <Text
            className={`text-[15px] ${
              tone === 'muted' ? 'text-tertiary' : 'text-primary'
            }`}
          >
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
