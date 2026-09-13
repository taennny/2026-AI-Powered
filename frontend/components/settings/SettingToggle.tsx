/** 설정 화면의 스위치 한 줄 + 결과 설명. 설명이 켬/끔에 따라 바뀐다 */

import {Switch, Text, View} from 'react-native';

import {useThemeColors} from '@/hooks/useThemeColors';

type Props = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  /** 지금 상태에서 무슨 일이 일어나는지 — 켬/끔 문구를 따로 받는다 */
  onDescription: string;
  offDescription: string;
};

export default function SettingToggle({
  label,
  value,
  onChange,
  onDescription,
  offDescription,
}: Props) {
  const tc = useThemeColors();

  return (
    <View className="gap-y-2">
      <View className="flex-row items-center justify-between pr-[34%]">
        <Text className="text-[15px] text-primary">{label}</Text>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{true: tc.tealAccent}}
        />
      </View>

      <Text className="text-[13px] leading-[19px] text-secondary pr-[32%]">
        {value ? onDescription : offDescription}
      </Text>
    </View>
  );
}
