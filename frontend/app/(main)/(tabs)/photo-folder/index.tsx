import {View, Text} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

export default function PhotoFolderScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-6 pt-6">
        <Text className="text-[28px] font-bold text-primary">
          사진 모아보기
        </Text>

        <Text className="mt-3 text-sm text-secondary">
          타임라인에 기록된 사진을 한곳에서 확인할 수 있어요.
        </Text>
      </View>
    </SafeAreaView>
  );
}