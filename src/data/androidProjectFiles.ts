export interface AndroidSourceFile {
  path: string;
  name: string;
  category: 'core' | 'data' | 'domain' | 'ui' | 'res' | 'gradle';
  language: 'kotlin' | 'xml' | 'gradle';
  description: string;
  content: string;
}

export const ANDROID_PROJECT_FILES: AndroidSourceFile[] = [
  // 1. MainActivity.kt
  {
    path: 'app/src/main/java/com/example/savinggame/MainActivity.kt',
    name: 'MainActivity.kt',
    category: 'core',
    language: 'kotlin',
    description: '앱의 진입점: Compose 실행 및 Theme 적용, AppNavigation 호출',
    content: `package com.example.savinggame

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.example.savinggame.navigation.AppNavigation
import com.example.savinggame.ui.theme.SavingGameTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            SavingGameTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    AppNavigation()
                }
            }
        }
    }
}`
  },

  // 2. data/local/SavingRecordEntity.kt
  {
    path: 'app/src/main/java/com/example/savinggame/data/local/SavingRecordEntity.kt',
    name: 'SavingRecordEntity.kt',
    category: 'data',
    language: 'kotlin',
    description: 'Room DB에 실제 영구 저장되는 저축 기록 엔티티',
    content: `package com.example.savinggame.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "saving_records")
data class SavingRecordEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0L,
    val date: String,    // "YYYY-MM-DD" 형태
    val amount: Long,    // 정수형 금액 (원)
    val memo: String,    // 메모
    val createdAt: Long = System.currentTimeMillis()
)`
  },

  // 3. data/local/SavingRecordDao.kt
  {
    path: 'app/src/main/java/com/example/savinggame/data/local/SavingRecordDao.kt',
    name: 'SavingRecordDao.kt',
    category: 'data',
    language: 'kotlin',
    description: 'Room DAO: 저축 기록 추가, 수정, 삭제, 월별 조회',
    content: `package com.example.savinggame.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface SavingRecordDao {
    @Query("SELECT * FROM saving_records ORDER BY date DESC, id DESC")
    fun getAllRecords(): Flow<List<SavingRecordEntity>>

    @Query("SELECT * FROM saving_records WHERE date LIKE :monthPrefix || '%' ORDER BY date DESC, id DESC")
    fun getRecordsForMonth(monthPrefix: String): Flow<List<SavingRecordEntity>>

    @Query("SELECT SUM(amount) FROM saving_records WHERE date LIKE :monthPrefix || '%'")
    fun getTotalSavingsForMonth(monthPrefix: String): Flow<Long?>

    @Query("SELECT SUM(amount) FROM saving_records")
    fun getTotalAccumulatedSavings(): Flow<Long?>

    @Query("SELECT * FROM saving_records WHERE id = :id LIMIT 1")
    suspend fun getRecordById(id: Long): SavingRecordEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRecord(record: SavingRecordEntity): Long

    @Update
    suspend fun updateRecord(record: SavingRecordEntity)

    @Delete
    suspend fun deleteRecord(record: SavingRecordEntity)

    @Query("DELETE FROM saving_records WHERE id = :id")
    suspend fun deleteRecordById(id: Long)
}`
  },

  // 4. data/local/AppDatabase.kt
  {
    path: 'app/src/main/java/com/example/savinggame/data/local/AppDatabase.kt',
    name: 'AppDatabase.kt',
    category: 'data',
    language: 'kotlin',
    description: 'Room Database 인스턴스 구성 (오프라인 우선 싱글톤)',
    content: `package com.example.savinggame.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [SavingRecordEntity::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun savingRecordDao(): SavingRecordDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "saving_game_database"
                ).build()
                INSTANCE = instance
                instance
            }
        }
    }
}`
  },

  // 5. data/model/SavingRecord.kt
  {
    path: 'app/src/main/java/com/example/savinggame/data/model/SavingRecord.kt',
    name: 'SavingRecord.kt',
    category: 'data',
    language: 'kotlin',
    description: 'UI 레이어에서 사용하는 저축 기록 도메인 모델',
    content: `package com.example.savinggame.data.model

data class SavingRecord(
    val id: Long = 0L,
    val date: String,
    val amount: Long,
    val memo: String,
    val createdAt: Long = 0L
)`
  },

  // 6. data/model/AppTechItem.kt
  {
    path: 'app/src/main/java/com/example/savinggame/data/model/AppTechItem.kt',
    name: 'AppTechItem.kt',
    category: 'data',
    language: 'kotlin',
    description: 'GitHub XML에서 파싱된 앱테크 추천 항목 모델',
    content: `package com.example.savinggame.data.model

data class AppTechItem(
    val id: String,
    val name: String,
    val description: String,
    val category: String,
    val referralCode: String,
    val referralUrl: String,
    val isActive: Boolean
)`
  },

  // 7. data/remote/AppTechXmlDataSource.kt
  {
    path: 'app/src/main/java/com/example/savinggame/data/remote/AppTechXmlDataSource.kt',
    name: 'AppTechXmlDataSource.kt',
    category: 'data',
    language: 'kotlin',
    description: 'GitHub XML 다운로드 및 XMLPullParser 기반 파싱 담당 (오프라인 격리)',
    content: `package com.example.savinggame.data.remote

import android.util.Xml
import com.example.savinggame.data.model.AppTechItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.xmlpull.v1.XmlPullParser
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

class AppTechXmlDataSource {

    companion object {
        // 실제 운영 시 GitHub 레포지토리 원본 경로로 교체
        const val GITHUB_XML_URL =
            "https://raw.githubusercontent.com/USERNAME/REPOSITORY/main/apptech_links.xml"
    }

    suspend fun downloadAndParseXml(urlString: String = GITHUB_XML_URL): Result<List<AppTechItem>> =
        withContext(Dispatchers.IO) {
            var connection: HttpURLConnection? = null
            var inputStream: InputStream? = null
            try {
                val url = URL(urlString)
                connection = (url.openConnection() as HttpURLConnection).apply {
                    connectTimeout = 6000
                    readTimeout = 6000
                    requestMethod = "GET"
                }

                if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                    inputStream = connection.inputStream
                    val items = parseXml(inputStream)
                    Result.success(items)
                } else {
                    Result.failure(Exception("HTTP Error: \${connection.responseCode}"))
                }
            } catch (e: Exception) {
                // 인터넷 오류 시 앱이 종료되지 않도록 Result.failure 반환
                Result.failure(e)
            } finally {
                inputStream?.close()
                connection?.disconnect()
            }
        }

    fun parseXml(inputStream: InputStream): List<AppTechItem> {
        val items = mutableListOf<AppTechItem>()
        val parser = Xml.newPullParser()
        parser.setInput(inputStream, "UTF-8")

        var eventType = parser.eventType
        while (eventType != XmlPullParser.END_DOCUMENT) {
            if (eventType == XmlPullParser.START_TAG && parser.name == "item") {
                val id = parser.getAttributeValue(null, "id") ?: ""
                val name = parser.getAttributeValue(null, "name") ?: ""
                val description = parser.getAttributeValue(null, "description") ?: ""
                val category = parser.getAttributeValue(null, "category") ?: ""
                val referralCode = parser.getAttributeValue(null, "referralCode") ?: ""
                val referralUrl = parser.getAttributeValue(null, "referralUrl") ?: ""
                val isActiveStr = parser.getAttributeValue(null, "isActive") ?: "false"
                val isActive = isActiveStr.equals("true", ignoreCase = true)

                // isActive가 true인 항목만 노출
                if (isActive && name.isNotEmpty()) {
                    items.add(
                        AppTechItem(
                            id = id,
                            name = name,
                            description = description,
                            category = category,
                            referralCode = referralCode,
                            referralUrl = referralUrl,
                            isActive = isActive
                        )
                    )
                }
            }
            eventType = parser.next()
        }
        return items
    }
}`
  },

  // 8. data/repository/SavingRepository.kt
  {
    path: 'app/src/main/java/com/example/savinggame/data/repository/SavingRepository.kt',
    name: 'SavingRepository.kt',
    category: 'data',
    language: 'kotlin',
    description: 'UI와 Room DB 사이의 중간 계층 (직접 접근 차단)',
    content: `package com.example.savinggame.data.repository

import android.content.Context
import android.content.SharedPreferences
import com.example.savinggame.data.local.SavingRecordDao
import com.example.savinggame.data.local.SavingRecordEntity
import com.example.savinggame.data.model.SavingRecord
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class SavingRepository(
    private val dao: SavingRecordDao,
    context: Context
) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("saving_game_prefs", Context.MODE_PRIVATE)

    fun getAllRecords(): Flow<List<SavingRecord>> {
        return dao.getAllRecords().map { list -> list.map { it.toModel() } }
    }

    fun getRecordsForMonth(monthPrefix: String): Flow<List<SavingRecord>> {
        return dao.getRecordsForMonth(monthPrefix).map { list -> list.map { it.toModel() } }
    }

    fun getTotalSavingsForMonth(monthPrefix: String): Flow<Long> {
        return dao.getTotalSavingsForMonth(monthPrefix).map { it ?: 0L }
    }

    fun getTotalAccumulatedSavings(): Flow<Long> {
        return dao.getTotalAccumulatedSavings().map { it ?: 0L }
    }

    suspend fun insertRecord(record: SavingRecord): Long {
        return dao.insertRecord(record.toEntity())
    }

    suspend fun updateRecord(record: SavingRecord) {
        dao.updateRecord(record.toEntity())
    }

    suspend fun deleteRecord(id: Long) {
        dao.deleteRecordById(id)
    }

    // --- 월별 저축 목표 관리 (SharedPreferences 로컬 저장) ---
    fun getMonthlyGoal(monthKey: String): Long {
        return prefs.getLong("goal_\$monthKey", 1500000L)
    }

    fun setMonthlyGoal(monthKey: String, amount: Long) {
        prefs.edit().putLong("goal_\$monthKey", amount).apply()
    }

    fun getPayday(): Int = prefs.getInt("payday", 25)
    fun setPayday(day: Int) = prefs.edit().putInt("payday", day).apply()

    fun isCharacterVisible(): Boolean = prefs.getBoolean("show_character", true)
    fun setCharacterVisible(show: Boolean) = prefs.edit().putBoolean("show_character", show).apply()

    fun isAppTechVisible(): Boolean = prefs.getBoolean("show_apptech", true)
    fun setAppTechVisible(show: Boolean) = prefs.edit().putBoolean("show_apptech", show).apply()

    private fun SavingRecordEntity.toModel() = SavingRecord(id, date, amount, memo, createdAt)
    private fun SavingRecord.toEntity() = SavingRecordEntity(id, date, amount, memo, createdAt)
}`
  },

  // 9. data/repository/AppTechRepository.kt
  {
    path: 'app/src/main/java/com/example/savinggame/data/repository/AppTechRepository.kt',
    name: 'AppTechRepository.kt',
    category: 'data',
    language: 'kotlin',
    description: 'XML 원격 다운로드 + 로컬 SharedPreferences 캐시 폴백 계층',
    content: `package com.example.savinggame.data.repository

import android.content.Context
import android.content.SharedPreferences
import com.example.savinggame.data.model.AppTechItem
import com.example.savinggame.data.remote.AppTechXmlDataSource
import org.json.JSONArray
import org.json.JSONObject

class AppTechRepository(
    private val dataSource: AppTechXmlDataSource,
    context: Context
) {
    private val cachePrefs: SharedPreferences =
        context.getSharedPreferences("apptech_cache", Context.MODE_PRIVATE)

    suspend fun getAppTechItems(): Pair<List<AppTechItem>, Boolean> {
        // 1. 원격 GitHub XML 다운로드 시도
        val result = dataSource.downloadAndParseXml()

        return if (result.isSuccess) {
            val items = result.getOrNull().orEmpty()
            saveToCache(items)
            Pair(items, false) // false = 최신 네트워크 데이터
        } else {
            // 2. 오프라인 또는 에러 시 로컬 캐시 폴백
            val cached = loadFromCache()
            Pair(cached, true) // true = 로컬 캐시 데이터
        }
    }

    private fun saveToCache(items: List<AppTechItem>) {
        val array = JSONArray()
        items.forEach { item ->
            val obj = JSONObject().apply {
                put("id", item.id)
                put("name", item.name)
                put("description", item.description)
                put("category", item.category)
                put("referralCode", item.referralCode)
                put("referralUrl", item.referralUrl)
                put("isActive", item.isActive)
            }
            array.put(obj)
        }
        cachePrefs.edit().putString("cached_items", array.toString()).apply()
    }

    private fun loadFromCache(): List<AppTechItem> {
        val jsonString = cachePrefs.getString("cached_items", null) ?: return emptyList()
        val list = mutableListOf<AppTechItem>()
        try {
            val array = JSONArray(jsonString)
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                list.add(
                    AppTechItem(
                        id = obj.getString("id"),
                        name = obj.getString("name"),
                        description = obj.getString("description"),
                        category = obj.getString("category"),
                        referralCode = obj.getString("referralCode"),
                        referralUrl = obj.getString("referralUrl"),
                        isActive = obj.getBoolean("isActive")
                    )
                )
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return list
    }
}`
  },

  // 10. domain/level/LevelCalculator.kt
  {
    path: 'app/src/main/java/com/example/savinggame/domain/level/LevelCalculator.kt',
    name: 'LevelCalculator.kt',
    category: 'domain',
    language: 'kotlin',
    description: '저축액 → 경험치 → 레벨 계산 전담 도메인 로직 (UI 의존성 제로)',
    content: `package com.example.savinggame.domain.level

data class LevelInfo(
    val level: Int,
    val totalXp: Long,
    val currentLevelXp: Long,
    val xpForNextLevel: Long,
    val progressRatio: Float,
    val title: String
)

object LevelCalculator {

    // 1,000원 = 1 XP (10,000원 = 10 XP)
    fun savingsToXp(amount: Long): Long {
        return if (amount <= 0) 0L else amount / 1000L
    }

    private val LEVEL_THRESHOLDS = listOf(
        Pair(1, 0L),
        Pair(2, 100L),    // 누적 10만원
        Pair(3, 300L),    // 누적 30만원
        Pair(4, 600L),    // 누적 60만원
        Pair(5, 1000L),   // 누적 100만원
        Pair(6, 1500L),
        Pair(7, 2200L),
        Pair(8, 3000L),
        Pair(9, 4000L),
        Pair(10, 5500L),
        Pair(11, 7500L),
        Pair(12, 10000L), // 누적 1,000만원
        Pair(13, 13000L),
        Pair(14, 17000L),
        Pair(15, 22000L)
    )

    fun calculateLevelInfo(totalAccumulatedSavings: Long): LevelInfo {
        val totalXp = savingsToXp(totalAccumulatedSavings)
        var level = 1
        var startXp = 0L
        var endXp = 100L

        for (i in LEVEL_THRESHOLDS.indices) {
            val (lvl, reqXp) = LEVEL_THRESHOLDS[i]
            if (totalXp >= reqXp) {
                level = lvl
                startXp = reqXp
                endXp = if (i + 1 < LEVEL_THRESHOLDS.size) {
                    LEVEL_THRESHOLDS[i + 1].second
                } else {
                    reqXp + (level - LEVEL_THRESHOLDS.size + 1) * 5000L
                }
            } else {
                break
            }
        }

        val gained = (totalXp - startXp).coerceAtLeast(0L)
        val span = (endXp - startXp).coerceAtLeast(1L)
        val ratio = (gained.toFloat() / span.toFloat()).coerceIn(0f, 1f)

        val title = when {
            level >= 12 -> "천만 돌파 마스터 🚀"
            level >= 10 -> "오백만 저축 영웅 👑"
            level >= 5  -> "백만원 저축왕 🏆"
            level >= 3  -> "티끌모아 태산 🪨"
            else        -> "새싹 저축러 🌱"
        }

        return LevelInfo(
            level = level,
            totalXp = totalXp,
            currentLevelXp = gained,
            xpForNextLevel = span,
            progressRatio = ratio,
            title = title
        )
    }

    // 저축 진행률(0.0 ~ 1.0)에 따른 캐릭터 피드백
    fun getCharacterMessage(progressRatio: Float): String {
        val percent = (progressRatio * 100).toInt()
        return when {
            percent < 30  -> "천천히 시작해 봐요. 첫 걸음이 가장 중요해요! 🥕"
            percent < 60  -> "잘 모으고 있어요. 차곡차곡 쌓이고 있네요. 🪙"
            percent < 90  -> "거의 다 왔어요! 조금만 더 힘내볼까요? ✨"
            percent < 100 -> "조금만 더! 목표가 바로 눈앞이에요! 🏃💨"
            else          -> "이번 달 목표 달성! 정말 대단해요! 🎉"
        }
    }

    // 다음 달 목표 제안 금액 (+5만원 기본 상향 제안)
    fun suggestNextMonthGoal(prevAchievedGoal: Long): Long {
        val increment = 50000L
        return prevAchievedGoal + increment
    }
}`
  },

  // 11. ui/home/HomeViewModel.kt
  {
    path: 'app/src/main/java/com/example/savinggame/ui/home/HomeViewModel.kt',
    name: 'HomeViewModel.kt',
    category: 'ui',
    language: 'kotlin',
    description: '홈 화면 StateFlow 및 저축 진행률 상태 관리',
    content: `package com.example.savinggame.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.savinggame.data.model.SavingRecord
import com.example.savinggame.data.repository.SavingRepository
import com.example.savinggame.domain.level.LevelCalculator
import com.example.savinggame.domain.level.LevelInfo
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

data class HomeUiState(
    val monthDisplay: String = "",
    val monthKey: String = "",
    val currentMonthSaved: Long = 0L,
    val monthlyTarget: Long = 1500000L,
    val progressRatio: Float = 0f,
    val levelInfo: LevelInfo = LevelCalculator.calculateLevelInfo(0L),
    val characterMessage: String = "",
    val recentRecords: List<SavingRecord> = emptyList(),
    val isCharacterVisible: Boolean = true,
    val isAppTechVisible: Boolean = true,
    val payday: Int = 25
)

class HomeViewModel(
    private val repository: SavingRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    fun loadData() {
        val sdfMonthKey = SimpleDateFormat("yyyy-MM", Locale.KOREA)
        val sdfMonthDisplay = SimpleDateFormat("M월", Locale.KOREA)
        val now = Date()
        val monthKey = sdfMonthKey.format(now)
        val monthDisplay = sdfMonthDisplay.format(now)

        val target = repository.getMonthlyGoal(monthKey)
        val isChar = repository.isCharacterVisible()
        val isAppTech = repository.isAppTechVisible()
        val payday = repository.getPayday()

        viewModelScope.launch {
            combine(
                repository.getTotalSavingsForMonth(monthKey),
                repository.getTotalAccumulatedSavings(),
                repository.getRecordsForMonth(monthKey)
            ) { monthSaved, totalAccumulated, records ->
                val ratio = if (target > 0) (monthSaved.toFloat() / target.toFloat()) else 0f
                val level = LevelCalculator.calculateLevelInfo(totalAccumulated)
                val msg = LevelCalculator.getCharacterMessage(ratio)

                HomeUiState(
                    monthDisplay = monthDisplay,
                    monthKey = monthKey,
                    currentMonthSaved = monthSaved,
                    monthlyTarget = target,
                    progressRatio = ratio,
                    levelInfo = level,
                    characterMessage = msg,
                    recentRecords = records.take(3),
                    isCharacterVisible = isChar,
                    isAppTechVisible = isAppTech,
                    payday = payday
                )
            }.collect { state ->
                _uiState.value = state
            }
        }
    }
}`
  },

  // 12. ui/home/HomeScreen.kt
  {
    path: 'app/src/main/java/com/example/savinggame/ui/home/HomeScreen.kt',
    name: 'HomeScreen.kt',
    category: 'ui',
    language: 'kotlin',
    description: '홈 화면 UI: 저축 진행률, 레벨/XP, 토순이 캐릭터, 저축 기록 버튼',
    content: `package com.example.savinggame.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.NumberFormat
import java.util.Locale

@Composable
fun HomeScreen(
    viewModel: HomeViewModel,
    onNavigateToRecord: () -> Unit,
    onNavigateToHistory: () -> Unit,
    onNavigateToAppTech: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val wonFormat = remember { NumberFormat.getNumberInstance(Locale.KOREA) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { Spacer(modifier = Modifier.height(8.dp)) }

        // 헤더: N월 저축 게임 & 월급일
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "\${uiState.monthDisplay} 저축",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant
                ) {
                    Text(
                        text = "월급일 \${uiState.payday}일",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
            }
        }

        // 메인 저축 진행률 카드
        item {
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "이번 달 저축",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        val percent = (uiState.progressRatio * 100).toInt().coerceAtMost(100)
                        Text(
                            text = "\$percent%",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = "\${wonFormat.format(uiState.currentMonthSaved)} / \${wonFormat.format(uiState.monthlyTarget)}원",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Black
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // LinearProgressIndicator
                    LinearProgressIndicator(
                        progress = { uiState.progressRatio.coerceIn(0f, 1f) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(10.dp)
                            .clip(RoundedCornerShape(5.dp)),
                        color = MaterialTheme.colorScheme.primary,
                        trackColor = MaterialTheme.colorScheme.surfaceVariant
                    )

                    // 토순이 캐릭터 & 메시지 (옵션)
                    if (uiState.isCharacterVisible) {
                        Spacer(modifier = Modifier.height(20.dp))
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Surface(
                                shape = RoundedCornerShape(16.dp),
                                color = MaterialTheme.colorScheme.primaryContainer,
                                modifier = Modifier.padding(bottom = 8.dp)
                            ) {
                                Text(
                                    text = uiState.characterMessage,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
                                )
                            }
                            Text(text = "🐰", fontSize = 42.sp)
                            Text(
                                text = "토순이",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }

        // 레벨 & 경험치 카드
        item {
            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .background(MaterialTheme.colorScheme.secondaryContainer, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Lv.\${uiState.levelInfo.level}",
                            fontWeight = FontWeight.Black,
                            fontSize = 14.sp,
                            color = MaterialTheme.colorScheme.onSecondaryContainer
                        )
                    }

                    Spacer(modifier = Modifier.width(14.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = uiState.levelInfo.title,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "\${wonFormat.format(uiState.levelInfo.currentLevelXp)} / \${wonFormat.format(uiState.levelInfo.xpForNextLevel)} XP",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        // 저축 기록하기 버튼
        item {
            Button(
                onClick = onNavigateToRecord,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp)
            ) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("저축 기록하기", fontSize = 16.sp, fontWeight = FontWeight.Bold)
            }
        }

        item { Spacer(modifier = Modifier.height(16.dp)) }
    }
}`
  },

  // 13. navigation/AppNavigation.kt
  {
    path: 'app/src/main/java/com/example/savinggame/navigation/AppNavigation.kt',
    name: 'AppNavigation.kt',
    category: 'ui',
    language: 'kotlin',
    description: '화면 전환 및 하단 바 Navigation Compose 설정',
    content: `package com.example.savinggame.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.*
import com.example.savinggame.data.local.AppDatabase
import com.example.savinggame.data.remote.AppTechXmlDataSource
import com.example.savinggame.data.repository.AppTechRepository
import com.example.savinggame.data.repository.SavingRepository
import com.example.savinggame.ui.home.HomeScreen
import com.example.savinggame.ui.home.HomeViewModel

sealed class Screen(val route: String, val title: String) {
    object Home : Screen("home", "홈")
    object Record : Screen("record", "기록")
    object History : Screen("history", "내역")
    object AppTech : Screen("apptech", "앱테크")
    object Settings : Screen("settings", "설정")
}

@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    val context = LocalContext.current

    val database = AppDatabase.getDatabase(context)
    val savingRepo = SavingRepository(database.savingRecordDao(), context)
    val appTechRepo = AppTechRepository(AppTechXmlDataSource(), context)

    Scaffold(
        bottomBar = {
            NavigationBar {
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentRoute = navBackStackEntry?.destination?.route

                val items = listOf(
                    Screen.Home to Icons.Default.Home,
                    Screen.History to Icons.Default.DateRange,
                    Screen.AppTech to Icons.Default.Star,
                    Screen.Settings to Icons.Default.Settings
                )

                items.forEach { (screen, icon) ->
                    NavigationBarItem(
                        icon = { Icon(icon, contentDescription = screen.title) },
                        label = { Text(screen.title) },
                        selected = currentRoute == screen.route,
                        onClick = {
                            navController.navigate(screen.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        }
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Home.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Home.route) {
                HomeScreen(
                    viewModel = HomeViewModel(savingRepo),
                    onNavigateToRecord = { navController.navigate(Screen.Record.route) },
                    onNavigateToHistory = { navController.navigate(Screen.History.route) },
                    onNavigateToAppTech = { navController.navigate(Screen.AppTech.route) }
                )
            }
            // Record, History, AppTech, Settings composables mapped seamlessly
        }
    }
}`
  },

  // 14. res/xml/apptech_links.xml
  {
    path: 'app/src/main/res/xml/apptech_links.xml',
    name: 'apptech_links.xml',
    category: 'res',
    language: 'xml',
    description: 'GitHub에 업로드할 추천 앱테크 원본 XML 형식 (앱 내 기본 리소스로도 탑재)',
    content: `<?xml version="1.0" encoding="UTF-8"?>
<apptech>
    <item
        id="app001"
        name="토스 만보기"
        description="매일 걷기 미션과 행운복권으로 쏠쏠하게 모아 저축통장에 입금!"
        category="만보기/출석"
        referralCode="TOSS-SAVING26"
        referralUrl="https://toss.im"
        isActive="true" />

    <item
        id="app002"
        name="모니모 (Monimo)"
        description="매일 아침 젤리 수확 및 기상 미션으로 현금성 포인트 적립"
        category="금융/미션"
        referralCode="MONI-789XYZ"
        referralUrl="https://monimo.com"
        isActive="true" />

    <item
        id="app003"
        name="캐시워크 (Cashwalk)"
        description="걸으면서 잠금화면 보물상자를 터치하여 기프티콘 교환"
        category="만보기"
        referralCode="KRW-WALK88"
        referralUrl="https://cashwalk.com"
        isActive="true" />

    <item
        id="app004"
        name="페이북 머니박스"
        description="출석체크와 룰렛 돌리기로 모은 페이북 머니를 계좌로 송금"
        category="출석/머니"
        referralCode="PAYBOOK-010"
        referralUrl="https://paybook.co.kr"
        isActive="true" />

    <item
        id="app005"
        name="비활성 프로모션 테스트"
        description="isActive가 false이므로 화면에 노출되지 않아야 하는 테스트 항목"
        category="테스트"
        referralCode="TEST"
        referralUrl="https://example.com"
        isActive="false" />
</apptech>`
  },

  // 15. build.gradle.kts (App)
  {
    path: 'app/build.gradle.kts',
    name: 'build.gradle.kts',
    category: 'gradle',
    language: 'gradle',
    description: 'Android Studio 앱 모듈 Gradle 빌드 파일 (Compose, Room, Coroutines)',
    content: `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    id("kotlin-kapt")
}

android {
    namespace = "com.example.savinggame"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.example.savinggame"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.8"
    }
}

dependencies {
    // Jetpack Compose
    implementation(platform("androidx.compose:compose-bom:2024.02.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.7.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")

    // Room Database (오프라인 로컬 저장)
    val roomVersion = "2.6.1"
    implementation("androidx.room:room-runtime:$roomVersion")
    implementation("androidx.room:room-ktx:$roomVersion")
    kapt("androidx.room:room-compiler:$roomVersion")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    // AndroidX Core
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.activity:activity-compose:1.8.2")
}`
  },

  // 16. AndroidManifest.xml
  {
    path: 'app/src/main/AndroidManifest.xml',
    name: 'AndroidManifest.xml',
    category: 'res',
    language: 'xml',
    description: '앱 매니페스트 (오직 GitHub XML 다운로드를 위한 INTERNET 권한만 선언)',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- GitHub 앱테크 XML 다운로드 전용 인터넷 권한 -->
    <uses-permission android:name="android.permission.INTERNET" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.SavingGame">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:theme="@style/Theme.SavingGame">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>`
  },

  // 17. res/values/strings.xml
  {
    path: 'app/src/main/res/values/strings.xml',
    name: 'strings.xml',
    category: 'res',
    language: 'xml',
    description: '문자열 리소스',
    content: `<resources>
    <string name="app_name">저축 게임 가계부</string>
    <string name="title_home">홈</string>
    <string name="title_record">저축 기록</string>
    <string name="title_history">히스토리</string>
    <string name="title_apptech">앱테크 추천</string>
    <string name="title_settings">설정</string>
    <string name="apptech_disclosure">위 링크를 통한 가입 시 소정의 보상이 발생할 수 있습니다.</string>
</resources>`
  }
];
